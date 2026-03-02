export interface StockMeta {
  shortName?: string;
  previousClose?: number;
  currency?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
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
