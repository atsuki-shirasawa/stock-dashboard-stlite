// ── Raw Yahoo Finance API types ──────────────────────────────────────────────

export interface YfTradingPeriod {
	timezone: string;
	start: number; // Unix seconds
	end: number; // Unix seconds
	gmtoffset: number;
}

export interface YfCurrentTradingPeriod {
	pre: YfTradingPeriod;
	regular: YfTradingPeriod;
	post: YfTradingPeriod;
}

/** Mirrors chart.result[0].meta from Yahoo Finance v8/chart API */
export interface YfMeta {
	currency?: string;
	symbol?: string;
	exchangeName?: string;
	fullExchangeName?: string;
	instrumentType?: string;
	firstTradeDate?: number; // Unix seconds
	regularMarketTime?: number; // Unix seconds
	hasPrePostMarketData?: boolean;
	gmtoffset?: number;
	timezone?: string;
	exchangeTimezoneName?: string;
	regularMarketPrice?: number;
	fiftyTwoWeekHigh?: number;
	fiftyTwoWeekLow?: number;
	regularMarketDayHigh?: number;
	regularMarketDayLow?: number;
	regularMarketVolume?: number;
	longName?: string;
	shortName?: string;
	chartPreviousClose?: number;
	previousClose?: number;
	scale?: number;
	priceHint?: number;
	currentTradingPeriod?: YfCurrentTradingPeriod;
	tradingPeriods?: YfTradingPeriod[][];
	dataGranularity?: string;
	range?: string;
	validRanges?: string[];
}

// ── App-level types ───────────────────────────────────────────────────────────

/** Parsed meta used throughout the app (Unix timestamps are in ms) */
export interface StockMeta {
	// identity
	symbol?: string;
	shortName?: string;
	longName?: string;
	currency?: string;
	exchangeName?: string;
	fullExchangeName?: string;
	instrumentType?: string;
	timezone?: string;
	exchangeTimezoneName?: string;
	gmtoffset?: number;
	// pricing
	regularMarketPrice?: number;
	previousClose?: number;
	chartPreviousClose?: number;
	regularMarketDayHigh?: number;
	regularMarketDayLow?: number;
	regularMarketVolume?: number;
	fiftyTwoWeekHigh?: number;
	fiftyTwoWeekLow?: number;
	// timing — all Unix ms (converted from API's Unix seconds)
	firstTradeDate?: number;
	regularMarketTime?: number;
	regularMarketOpen?: number; // derived from currentTradingPeriod.regular.start * 1000
	regularMarketClose?: number; // derived from currentTradingPeriod.regular.end * 1000
	// misc
	priceHint?: number;
	dataGranularity?: string;
	range?: string;
}

export interface OHLCVRow {
	timestamp: number; // Unix ms
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface ChartData {
	rows: OHLCVRow[];
	meta: StockMeta;
}

export type ChartType = "Candlestick" | "Area";
export type PeriodLabel = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y" | "10Y";
