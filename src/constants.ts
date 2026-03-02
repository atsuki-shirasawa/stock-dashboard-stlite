// Color theme (1:1 with Python version)
export const BG = "#0d1117";
export const PANEL_BG = "#161b22";
export const UP_COLOR = "#00d4a0";
export const DOWN_COLOR = "#f43f5e";
export const UP_FILL = "rgba(0,212,160,0.20)";
export const DOWN_FILL = "rgba(244,63,94,0.20)";
export const VOL_UP = "rgba(0,212,160,0.50)";
export const VOL_DOWN = "rgba(244,63,94,0.50)";
export const GRID_COLOR = "rgba(255,255,255,0.05)";
export const SPIKE_COLOR = "rgba(255,255,255,0.25)";
export const TEXT_COLOR = "#c9d1d9";
export const SUBTEXT_COLOR = "#8b949e";

// Period config (1:1 with Python version)
export const PERIODS: Record<string, { period: string; interval: string }> = {
  "1D": { period: "1d", interval: "5m" },
  "1W": { period: "5d", interval: "30m" },
  "1M": { period: "1mo", interval: "1d" },
  "6M": { period: "6mo", interval: "1d" },
  "1Y": { period: "1y", interval: "1d" },
  "5Y": { period: "5y", interval: "1wk" },
  "10Y": { period: "10y", interval: "1mo" },
};

export const PERIOD_DELTA_MS: Record<string, number> = {
  "1D": 1 * 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "6M": 182 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
  "5Y": 365 * 5 * 24 * 60 * 60 * 1000,
  "10Y": 365 * 10 * 24 * 60 * 60 * 1000,
};

export const DELTA_LABELS: Record<string, string> = {
  "1D": "vs prev day",
  "1W": "vs 1W ago",
  "1M": "vs 1M ago",
  "6M": "vs 6M ago",
  "1Y": "vs 1Y ago",
  "5Y": "vs 5Y ago",
  "10Y": "vs 10Y ago",
};

// URL param mappings (1:1 with Python version)
export const PERIOD_TO_KEY: Record<string, string> = {
  "1D": "1d",
  "1W": "1w",
  "1M": "1mo",
  "6M": "6mo",
  "1Y": "1y",
  "5Y": "5y",
  "10Y": "10y",
};
export const PERIOD_FROM_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(PERIOD_TO_KEY).map(([k, v]) => [v, k]),
);

export const CHART_TYPES = ["Candlestick", "Area"] as const;
export const CHART_TO_KEY: Record<string, string> = {
  Candlestick: "candlestick",
  Area: "area",
};
export const CHART_FROM_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(CHART_TO_KEY).map(([k, v]) => [v, k]),
);

export const DEFAULT_SYMBOL = "AAPL";
export const DEFAULT_PERIOD = "1Y";
export const DEFAULT_CHART = "Area";

// Cache TTL in milliseconds (5 minutes, same as @st.cache_data(ttl=300))
export const CACHE_TTL_MS = 5 * 60 * 1000;
