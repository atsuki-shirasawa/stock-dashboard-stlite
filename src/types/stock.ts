export interface StockMeta {
	shortName?: string;
	previousClose?: number;
	regularMarketPrice?: number; // 現在の市場価格（全期間で色判定に使用）
	currency?: string;
	fiftyTwoWeekHigh?: number;
	fiftyTwoWeekLow?: number;
	regularMarketOpen?: number; // Unix ms — trading session start
	regularMarketClose?: number; // Unix ms — trading session end
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
