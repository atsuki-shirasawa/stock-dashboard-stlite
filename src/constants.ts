import type { PeriodLabel } from "./types/stock";

export type ThemeMode = "auto" | "light" | "dark";

export interface Theme {
	BG: string;
	PANEL_BG: string;
	UP_COLOR: string;
	DOWN_COLOR: string;
	UP_FILL: string;
	DOWN_FILL: string;
	UP_FILL_GRAD_TOP: string;
	UP_FILL_GRAD_BOT: string;
	DOWN_FILL_GRAD_TOP: string;
	DOWN_FILL_GRAD_BOT: string;
	VOL_UP: string;
	VOL_DOWN: string;
	GRID_COLOR: string;
	SPIKE_COLOR: string;
	HOVER_BORDER: string;
	DIVIDER_COLOR: string;
	ERROR_BG: string;
	ERROR_BORDER: string;
	TEXT_COLOR: string;
	SUBTEXT_COLOR: string;
}

export const LIGHT_THEME: Theme = {
	BG: "#f8fafc",
	PANEL_BG: "#ffffff",
	UP_COLOR: "#10b981",
	DOWN_COLOR: "#ef4444",
	UP_FILL: "rgba(16,185,129,0.12)",
	DOWN_FILL: "rgba(239,68,68,0.10)",
	UP_FILL_GRAD_TOP: "rgba(16,185,129,0.5)",
	UP_FILL_GRAD_BOT: "rgba(16,185,129,0.0)",
	DOWN_FILL_GRAD_TOP: "rgba(239,68,68,0.5)",
	DOWN_FILL_GRAD_BOT: "rgba(239,68,68,0.0)",
	VOL_UP: "rgba(16,185,129,0.40)",
	VOL_DOWN: "rgba(239,68,68,0.40)",
	GRID_COLOR: "rgba(148,163,184,0.20)",
	SPIKE_COLOR: "rgba(100,116,139,0.40)",
	HOVER_BORDER: "rgba(100,116,139,0.20)",
	DIVIDER_COLOR: "rgba(100,116,139,0.15)",
	ERROR_BG: "rgba(239,68,68,0.08)",
	ERROR_BORDER: "rgba(239,68,68,0.25)",
	TEXT_COLOR: "#0f172a",
	SUBTEXT_COLOR: "#64748b",
};

export const DARK_THEME: Theme = {
	BG: "#0f172a",
	PANEL_BG: "#1e293b",
	UP_COLOR: "#10b981",
	DOWN_COLOR: "#ef4444",
	UP_FILL: "rgba(16,185,129,0.15)",
	DOWN_FILL: "rgba(239,68,68,0.12)",
	UP_FILL_GRAD_TOP: "rgba(16,185,129,0.5)",
	UP_FILL_GRAD_BOT: "rgba(16,185,129,0.0)",
	DOWN_FILL_GRAD_TOP: "rgba(239,68,68,0.5)",
	DOWN_FILL_GRAD_BOT: "rgba(239,68,68,0.0)",
	VOL_UP: "rgba(16,185,129,0.40)",
	VOL_DOWN: "rgba(239,68,68,0.40)",
	GRID_COLOR: "rgba(148,163,184,0.12)",
	SPIKE_COLOR: "rgba(148,163,184,0.40)",
	HOVER_BORDER: "rgba(148,163,184,0.20)",
	DIVIDER_COLOR: "rgba(148,163,184,0.15)",
	ERROR_BG: "rgba(239,68,68,0.12)",
	ERROR_BORDER: "rgba(239,68,68,0.30)",
	TEXT_COLOR: "#f1f5f9",
	SUBTEXT_COLOR: "#94a3b8",
};

export const FONT_FAMILY =
	"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Period config (1:1 with Python version)
export const PERIODS: Record<
	PeriodLabel,
	{ period: string; interval: string }
> = {
	"1D": { period: "1d", interval: "5m" },
	"1W": { period: "5d", interval: "30m" },
	"1M": { period: "1mo", interval: "1d" },
	"6M": { period: "6mo", interval: "1d" },
	"1Y": { period: "1y", interval: "1d" },
	"5Y": { period: "5y", interval: "1wk" },
	"10Y": { period: "10y", interval: "1mo" },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PERIOD_DELTA_MS: Record<PeriodLabel, number> = {
	"1D": 1 * MS_PER_DAY,
	"1W": 7 * MS_PER_DAY,
	"1M": 30 * MS_PER_DAY,
	"6M": 182 * MS_PER_DAY,
	"1Y": 365 * MS_PER_DAY,
	"5Y": 365 * 5 * MS_PER_DAY,
	"10Y": 365 * 10 * MS_PER_DAY,
};

export const DELTA_LABELS: Record<PeriodLabel, string> = {
	"1D": "vs prev day",
	"1W": "vs 1W ago",
	"1M": "vs 1M ago",
	"6M": "vs 6M ago",
	"1Y": "vs 1Y ago",
	"5Y": "vs 5Y ago",
	"10Y": "vs 10Y ago",
};

// URL param mappings (1:1 with Python version)
export const PERIOD_TO_KEY: Record<PeriodLabel, string> = {
	"1D": "1d",
	"1W": "1w",
	"1M": "1mo",
	"6M": "6mo",
	"1Y": "1y",
	"5Y": "5y",
	"10Y": "10y",
};
export const PERIOD_FROM_KEY: Record<string, PeriodLabel> = Object.fromEntries(
	Object.entries(PERIOD_TO_KEY).map(([k, v]) => [v, k]),
) as Record<string, PeriodLabel>;

export const CHART_TO_KEY: Record<string, string> = {
	Candlestick: "candlestick",
	Area: "area",
};
export const CHART_FROM_KEY: Record<string, string> = Object.fromEntries(
	Object.entries(CHART_TO_KEY).map(([k, v]) => [v, k]),
);

export const DEFAULT_SYMBOL = "AAPL";
export const DEFAULT_PERIOD: PeriodLabel = "1Y";
export const DEFAULT_CHART = "Area";

// Cache TTL in milliseconds (5 minutes, same as @st.cache_data(ttl=300))
export const CACHE_TTL_MS = 5 * 60 * 1000;
