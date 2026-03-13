import { CACHE_TTL_MS, PERIOD_DELTA_MS, PERIODS } from "../constants";
import type { ChartData, PeriodLabel, StockMeta, YfMeta } from "../types/stock";

const YF_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const YF_BASE_FALLBACK = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
		"AppleWebKit/537.36 (KHTML, like Gecko) " +
		"Chrome/120.0.0.0 Safari/537.36",
	Accept: "application/json",
};

const CORS_PROXIES: Array<(url: string) => string> = [
	(url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
	(url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

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

let cachedCrumb: string | null = null;
let crumbFetchedAt = 0;
const CRUMB_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchCrumb(signal?: AbortSignal): Promise<string | null> {
	if (cachedCrumb && Date.now() - crumbFetchedAt < CRUMB_TTL_MS) {
		return cachedCrumb;
	}
	const crumbEndpoint = "https://query2.finance.yahoo.com/v1/test/getcrumb";
	for (const buildProxy of CORS_PROXIES) {
		try {
			const resp = await fetch(buildProxy(crumbEndpoint), {
				headers: YF_HEADERS,
				signal,
			});
			if (resp.ok) {
				const text = (await resp.text()).trim();
				// crumb is a short alphanumeric string; guard against HTML responses
				if (text && text.length < 64 && !text.startsWith("<")) {
					cachedCrumb = text;
					crumbFetchedAt = Date.now();
					return cachedCrumb;
				}
			}
		} catch {
			// try next proxy
		}
	}
	return null;
}

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

interface CacheEntry {
	data: ChartData;
	expiresAt: number;
}

function cacheKey(
	symbol: string,
	periodLabel: PeriodLabel,
	endDate?: Date,
): string {
	return `yf:${symbol}:${periodLabel}:${endDate?.toISOString() ?? "today"}`;
}

function getCached(key: string): ChartData | null {
	try {
		const raw = sessionStorage.getItem(key);
		if (!raw) return null;
		const entry: CacheEntry = JSON.parse(raw) as CacheEntry;
		if (Date.now() > entry.expiresAt) {
			sessionStorage.removeItem(key);
			return null;
		}
		return entry.data;
	} catch {
		return null;
	}
}

function setCached(key: string, data: ChartData): void {
	try {
		const entry: CacheEntry = { data, expiresAt: Date.now() + CACHE_TTL_MS };
		sessionStorage.setItem(key, JSON.stringify(entry));
	} catch {
		// sessionStorage full — ignore
	}
}

async function fetchWithFallback(
	symbol: string,
	periodLabel: PeriodLabel,
	endDate?: Date,
	signal?: AbortSignal,
): Promise<Response> {
	const cacheBust = Math.floor(Date.now() / CACHE_TTL_MS);
	const crumb = await fetchCrumb(signal);

	// Try each combination of (base, proxy) until one succeeds
	const bases = [YF_BASE, YF_BASE_FALLBACK];
	for (const base of bases) {
		const yfUrl = buildYfUrl(
			symbol,
			periodLabel,
			endDate,
			cacheBust,
			crumb,
			base,
		);
		for (const buildProxy of CORS_PROXIES) {
			try {
				const resp = await fetch(buildProxy(yfUrl), {
					headers: YF_HEADERS,
					signal,
				});
				if (resp.ok) return resp;
			} catch (err) {
				// AbortError should propagate immediately
				if (err instanceof DOMException && err.name === "AbortError") throw err;
				// otherwise try next combination
			}
		}
	}

	throw new Error(
		"All Yahoo Finance endpoints returned errors. The API may be temporarily unavailable.",
	);
}

export async function fetchChart(
	symbol: string,
	periodLabel: PeriodLabel,
	endDate?: Date,
	signal?: AbortSignal,
): Promise<ChartData> {
	const key = cacheKey(symbol, periodLabel, endDate);
	const cached = getCached(key);
	if (cached) return cached;

	const resp = await fetchWithFallback(symbol, periodLabel, endDate, signal);

	const json = (await resp.json()) as YfResponse;
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

	const meta = parseMeta(result.meta ?? {});
	const data: ChartData = { rows, meta };
	setCached(key, data);
	return data;
}
