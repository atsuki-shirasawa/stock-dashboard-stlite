import {
	CACHE_TTL_MS,
	FETCH_TIMEOUT_MS,
	PERIOD_CACHE_TTL_MS,
	PERIOD_DELTA_MS,
	PERIODS,
	STALE_MAX_AGE_MS,
} from "../constants";
import type { ChartData, PeriodLabel, StockMeta, YfMeta } from "../types/stock";

const YF_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const YF_BASE_FALLBACK = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
const YF_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
		"AppleWebKit/537.36 (KHTML, like Gecko) " +
		"Chrome/120.0.0.0 Safari/537.36",
	Accept: "application/json",
};

/**
 * Optional self-hosted CORS proxy (see `worker/`). Its edge cache is shared by
 * every viewer, so a hit there costs Yahoo nothing — it is tried on its own
 * before falling back to the public proxies.
 */
const SELF_PROXY = import.meta.env.VITE_YF_PROXY?.replace(/\/+$/, "");

const PUBLIC_PROXIES: Array<(url: string) => string> = [
	(url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
	(url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

function selfProxyUrl(url: string, ttlSec: number): string {
	return `${SELF_PROXY}?ttl=${ttlSec}&url=${encodeURIComponent(url)}`;
}

interface YfQuote {
	open?: (number | null)[];
	high?: (number | null)[];
	low?: (number | null)[];
	close?: (number | null)[];
	volume?: (number | null)[];
}

interface YfResult {
	timestamp?: number[];
	indicators?: { quote?: YfQuote[] };
	meta?: YfMeta;
}

interface YfResponse {
	chart?: { result?: YfResult[]; error?: unknown };
}

// ---------------------------------------------------------------------------
// Storage — localStorage so the cache survives an embed (iframe) reload, which
// sessionStorage does not. Falls back to sessionStorage, then to no cache at
// all (Safari private mode, third-party storage blocked in an iframe).
// ---------------------------------------------------------------------------

const CACHE_PREFIX = "yf:";

function pickStore(): Storage | null {
	for (const get of [() => localStorage, () => sessionStorage]) {
		try {
			const s = get();
			const probe = `${CACHE_PREFIX}probe`;
			s.setItem(probe, "1");
			s.removeItem(probe);
			return s;
		} catch {
			// unavailable — try the next one
		}
	}
	return null;
}

const store: Storage | null = pickStore();

function readJson<T>(key: string): T | null {
	try {
		const raw = store?.getItem(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

function purgeCache(): void {
	if (!store) return;
	const keys: string[] = [];
	for (let i = 0; i < store.length; i++) {
		const k = store.key(i);
		if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
	}
	for (const k of keys) store.removeItem(k);
}

function writeJson(key: string, value: unknown): void {
	if (!store) return;
	const payload = JSON.stringify(value);
	try {
		store.setItem(key, payload);
	} catch {
		// Quota exceeded — drop our own entries and retry once.
		purgeCache();
		try {
			store.setItem(key, payload);
		} catch {
			// still no room — run without a cache
		}
	}
}

// ---------------------------------------------------------------------------
// Fetching — every attempt is bounded by a timeout and all candidate endpoints
// race in parallel, so one hanging proxy no longer stalls the whole load.
// ---------------------------------------------------------------------------

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

interface Attempt<T> {
	run: () => Promise<T>;
	cancel: () => void;
}

function makeAttempt<T>(
	url: string,
	parse: (text: string) => T,
	signal?: AbortSignal,
): Attempt<T> {
	const ctrl = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const onAbort = () => ctrl.abort(signal?.reason);
	const cleanup = () => {
		if (timer !== undefined) clearTimeout(timer);
		signal?.removeEventListener("abort", onAbort);
	};

	return {
		// Safe to call on the winner too: by then the body has been read, so the
		// abort is a no-op. On the losers it frees the connection.
		cancel: () => {
			cleanup();
			ctrl.abort();
		},
		run: async () => {
			if (signal?.aborted) throw signal.reason;
			signal?.addEventListener("abort", onAbort, { once: true });
			timer = setTimeout(
				() => ctrl.abort(new DOMException("Request timed out", "TimeoutError")),
				FETCH_TIMEOUT_MS,
			);
			try {
				const resp = await fetch(url, {
					headers: YF_HEADERS,
					signal: ctrl.signal,
				});
				if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
				// Parsing inside the attempt makes a proxy that answers 200 with an
				// HTML error page lose the race instead of poisoning the result.
				return parse(await resp.text());
			} finally {
				cleanup();
			}
		},
	};
}

async function race<T>(
	urls: string[],
	parse: (text: string) => T,
	signal?: AbortSignal,
): Promise<T> {
	if (urls.length === 0) throw new Error("No endpoints configured");
	const attempts = urls.map((url) => makeAttempt(url, parse, signal));
	try {
		return await Promise.any(attempts.map((a) => a.run()));
	} catch (err) {
		if (signal?.aborted) throw signal.reason;
		throw err;
	} finally {
		for (const a of attempts) a.cancel();
	}
}

// ---------------------------------------------------------------------------
// Crumb
// ---------------------------------------------------------------------------

const CRUMB_KEY = `${CACHE_PREFIX}crumb`;
const CRUMB_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CrumbEntry {
	value: string;
	expiresAt: number;
}

let crumbMemo: CrumbEntry | null = null;

function parseCrumb(text: string): string {
	const s = text.trim();
	// crumb is a short alphanumeric string; guard against HTML responses
	if (!s || s.length >= 64 || s.startsWith("<")) {
		throw new Error("Not a crumb");
	}
	return s;
}

/** Never rejects — a missing crumb is not fatal for the v8 chart endpoint. */
async function fetchCrumb(signal?: AbortSignal): Promise<string | null> {
	const now = Date.now();
	if (crumbMemo && now < crumbMemo.expiresAt) return crumbMemo.value;

	const stored = readJson<CrumbEntry>(CRUMB_KEY);
	if (stored && now < stored.expiresAt) {
		crumbMemo = stored;
		return stored.value;
	}

	const urls = [
		...(SELF_PROXY ? [selfProxyUrl(YF_CRUMB_URL, 3600)] : []),
		...PUBLIC_PROXIES.map((p) => p(YF_CRUMB_URL)),
	];
	try {
		const value = await race(urls, parseCrumb, signal);
		crumbMemo = { value, expiresAt: Date.now() + CRUMB_TTL_MS };
		writeJson(CRUMB_KEY, crumbMemo);
		return value;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

function buildYfUrl(
	symbol: string,
	periodLabel: PeriodLabel,
	endDate?: Date,
	cacheBust?: number,
	crumb?: string | null,
	base = YF_BASE,
): string {
	const cfg = PERIODS[periodLabel];
	if (!cfg) throw new Error(`Unknown period: ${periodLabel}`);
	const { interval } = cfg;

	let yfUrl: string;
	if (!endDate) {
		yfUrl = `${base}/${symbol}?range=${cfg.period}&interval=${interval}`;
	} else {
		const endMs = endDate.getTime();
		const startMs = endMs - (PERIOD_DELTA_MS[periodLabel] ?? 0);
		const period1 = Math.floor(startMs / 1000);
		const period2 = Math.floor(endMs / 1000);
		yfUrl = `${base}/${symbol}?period1=${period1}&period2=${period2}&interval=${interval}`;
	}
	if (cacheBust !== undefined) {
		yfUrl += `&_t=${cacheBust}`;
	}
	if (crumb) {
		yfUrl += `&crumb=${encodeURIComponent(crumb)}`;
	}
	return yfUrl;
}

function parseChartJson(text: string): YfResponse {
	const json: unknown = JSON.parse(text);
	if (typeof json !== "object" || json === null || !("chart" in json)) {
		throw new Error("Unexpected response shape");
	}
	return json as YfResponse;
}

async function fetchChartJson(
	symbol: string,
	periodLabel: PeriodLabel,
	ttlMs: number,
	endDate?: Date,
	signal?: AbortSignal,
): Promise<YfResponse> {
	const cacheBust = Math.floor(Date.now() / ttlMs);
	const ttlSec = Math.round(ttlMs / 1000);
	// Kick the crumb off now but do not block on it — the chart endpoint usually
	// works without one, and waiting would add a round trip to every cold load.
	const crumbPromise = fetchCrumb(signal);

	const attempt = async (crumb: string | null): Promise<YfResponse> => {
		const targets = [YF_BASE, YF_BASE_FALLBACK].map((base) =>
			buildYfUrl(symbol, periodLabel, endDate, cacheBust, crumb, base),
		);
		if (SELF_PROXY) {
			try {
				return await race(
					targets.map((t) => selfProxyUrl(t, ttlSec)),
					parseChartJson,
					signal,
				);
			} catch (err) {
				if (isAbortError(err)) throw err;
				// self-hosted proxy is down — fall through to the public ones
			}
		}
		return race(
			targets.flatMap((t) => PUBLIC_PROXIES.map((p) => p(t))),
			parseChartJson,
			signal,
		);
	};

	try {
		return await attempt(null);
	} catch (err) {
		if (isAbortError(err)) throw err;
		const crumb = await crumbPromise;
		if (!crumb) {
			throw new Error(
				"All Yahoo Finance endpoints returned errors. The API may be temporarily unavailable.",
			);
		}
		try {
			return await attempt(crumb);
		} catch (retryErr) {
			if (isAbortError(retryErr)) throw retryErr;
			throw new Error(
				"All Yahoo Finance endpoints returned errors. The API may be temporarily unavailable.",
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseMeta(meta: YfMeta): StockMeta {
	const regular = meta.currentTradingPeriod?.regular;
	return {
		symbol: meta.symbol,
		shortName: meta.shortName || meta.longName,
		longName: meta.longName,
		currency: meta.currency,
		exchangeName: meta.exchangeName,
		fullExchangeName: meta.fullExchangeName,
		instrumentType: meta.instrumentType,
		timezone: meta.timezone,
		exchangeTimezoneName: meta.exchangeTimezoneName,
		gmtoffset: meta.gmtoffset,
		regularMarketPrice: meta.regularMarketPrice,
		previousClose: meta.previousClose,
		chartPreviousClose: meta.chartPreviousClose,
		regularMarketDayHigh: meta.regularMarketDayHigh,
		regularMarketDayLow: meta.regularMarketDayLow,
		regularMarketVolume: meta.regularMarketVolume,
		fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
		fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
		firstTradeDate:
			meta.firstTradeDate != null ? meta.firstTradeDate * 1000 : undefined,
		regularMarketTime:
			meta.regularMarketTime != null
				? meta.regularMarketTime * 1000
				: undefined,
		regularMarketOpen:
			regular?.start != null ? regular.start * 1000 : undefined,
		regularMarketClose: regular?.end != null ? regular.end * 1000 : undefined,
		priceHint: meta.priceHint,
		dataGranularity: meta.dataGranularity,
		range: meta.range,
	};
}

function parseChart(json: YfResponse): ChartData {
	const chartResults = json?.chart?.result;
	if (!Array.isArray(chartResults) || chartResults.length === 0) {
		return { rows: [], meta: {} };
	}

	const result = chartResults[0] as YfResult;
	const timestamps: number[] = result.timestamp ?? [];
	const quote: YfQuote = result.indicators?.quote?.[0] ?? {};
	const opens = quote.open ?? [];
	const highs = quote.high ?? [];
	const lows = quote.low ?? [];
	const closes = quote.close ?? [];
	const volumes = quote.volume ?? [];

	const rows = timestamps
		.map((ts, i) => ({
			timestamp: ts * 1000,
			open: opens[i] ?? Number.NaN,
			high: highs[i] ?? Number.NaN,
			low: lows[i] ?? Number.NaN,
			close: closes[i] ?? Number.NaN,
			volume: volumes[i] ?? 0,
		}))
		.filter((r) => !Number.isNaN(r.close));

	return { rows, meta: parseMeta(result.meta ?? {}) };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
	data: ChartData;
	fetchedAt?: number;
	expiresAt: number;
}

interface CacheHit {
	data: ChartData;
	fetchedAt: number;
	fresh: boolean;
}

function cacheKey(
	symbol: string,
	periodLabel: PeriodLabel,
	endDate?: Date,
): string {
	return `${CACHE_PREFIX}${symbol}:${periodLabel}:${endDate?.toISOString() ?? "today"}`;
}

/**
 * Expired entries are kept rather than deleted: they are the fallback shown when
 * every endpoint fails. Only entries older than STALE_MAX_AGE_MS are dropped.
 */
function readCache(key: string): CacheHit | null {
	const entry = readJson<CacheEntry>(key);
	if (!entry?.data) return null;

	const now = Date.now();
	const fetchedAt = entry.fetchedAt ?? entry.expiresAt - CACHE_TTL_MS;
	if (now - fetchedAt > STALE_MAX_AGE_MS) {
		store?.removeItem(key);
		return null;
	}
	return { data: entry.data, fetchedAt, fresh: now < entry.expiresAt };
}

function writeCache(key: string, data: ChartData, ttlMs: number): number {
	const fetchedAt = Date.now();
	const entry: CacheEntry = {
		data,
		fetchedAt,
		expiresAt: fetchedAt + ttlMs,
	};
	writeJson(key, entry);
	return fetchedAt;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchChart(
	symbol: string,
	periodLabel: PeriodLabel,
	endDate?: Date,
	signal?: AbortSignal,
): Promise<ChartData> {
	const ttlMs = PERIOD_CACHE_TTL_MS[periodLabel] ?? CACHE_TTL_MS;
	const key = cacheKey(symbol, periodLabel, endDate);
	const cached = readCache(key);
	if (cached?.fresh) {
		return { ...cached.data, fetchedAt: cached.fetchedAt };
	}

	const serveStale = (hit: CacheHit): ChartData => ({
		...hit.data,
		fetchedAt: hit.fetchedAt,
		stale: true,
	});

	try {
		const json = await fetchChartJson(
			symbol,
			periodLabel,
			ttlMs,
			endDate,
			signal,
		);
		const data = parseChart(json);
		// An empty payload for a symbol we have history for means the upstream
		// answered but with nothing useful — the stale rows beat a blank chart.
		if (data.rows.length === 0 && cached) return serveStale(cached);
		const fetchedAt = writeCache(key, data, ttlMs);
		return { ...data, fetchedAt };
	} catch (err) {
		if (isAbortError(err)) throw err;
		if (cached) return serveStale(cached);
		throw err;
	}
}
