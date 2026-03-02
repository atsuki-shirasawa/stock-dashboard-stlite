import { CACHE_TTL_MS, PERIOD_DELTA_MS, PERIODS } from "../constants";
import type { ChartData, StockMeta } from "../types/stock";

const CORS_PROXY = "https://corsproxy.io/?url=";
const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
		"AppleWebKit/537.36 (KHTML, like Gecko) " +
		"Chrome/120.0.0.0 Safari/537.36",
	Accept: "application/json",
};

function buildYfUrl(
	symbol: string,
	periodLabel: string,
	endDate?: Date,
): string {
	const cfg = PERIODS[periodLabel];
	if (!cfg) throw new Error(`Unknown period: ${periodLabel}`);
	const { interval } = cfg;

	let yfUrl: string;
	if (!endDate) {
		yfUrl = `${YF_BASE}/${symbol}?range=${cfg.period}&interval=${interval}`;
	} else {
		const endMs = endDate.getTime();
		const startMs = endMs - (PERIOD_DELTA_MS[periodLabel] ?? 0);
		const period1 = Math.floor(startMs / 1000);
		const period2 = Math.floor(endMs / 1000);
		yfUrl = `${YF_BASE}/${symbol}?period1=${period1}&period2=${period2}&interval=${interval}`;
	}
	return CORS_PROXY + encodeURIComponent(yfUrl);
}

function parseMeta(meta: Record<string, unknown>): StockMeta {
	return {
		shortName:
			(meta.shortName as string | undefined) ||
			(meta.longName as string | undefined),
		previousClose:
			(meta.chartPreviousClose as number | undefined) ||
			(meta.previousClose as number | undefined),
		currency: meta.currency as string | undefined,
		fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh as number | undefined,
		fiftyTwoWeekLow: meta.fiftyTwoWeekLow as number | undefined,
	};
}

interface CacheEntry {
	data: ChartData;
	expiresAt: number;
}

function cacheKey(symbol: string, periodLabel: string, endDate?: Date): string {
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

export async function fetchChart(
	symbol: string,
	periodLabel: string,
	endDate?: Date,
	signal?: AbortSignal,
): Promise<ChartData> {
	const key = cacheKey(symbol, periodLabel, endDate);
	const cached = getCached(key);
	if (cached) return cached;

	const url = buildYfUrl(symbol, periodLabel, endDate);
	const resp = await fetch(url, { headers: YF_HEADERS, signal });
	if (!resp.ok) {
		throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
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
		meta?: Record<string, unknown>;
	}
	interface YfResponse {
		chart?: { result?: YfResult[] };
	}
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

	const data: ChartData = {
		rows,
		meta: parseMeta(result.meta ?? {}),
	};
	setCached(key, data);
	return data;
}
