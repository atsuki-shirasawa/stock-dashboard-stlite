import type { ThemeMode } from "../constants";
import {
	CHART_FROM_KEY,
	CHART_TO_KEY,
	DEFAULT_CHART,
	DEFAULT_PERIOD,
	DEFAULT_SYMBOL,
	PERIOD_FROM_KEY,
	PERIOD_TO_KEY,
} from "../constants";
import type { ChartType, PeriodLabel } from "../types/stock";

export interface AppParams {
	symbol: string;
	period: PeriodLabel;
	chartType: ChartType;
	endDate: Date | undefined;
	showVolume: boolean;
	themeMode: ThemeMode;
}

export function readParams(): AppParams {
	const p = new URLSearchParams(window.location.search);
	const symbolRaw = p.get("symbol") ?? DEFAULT_SYMBOL;
	const symbol = symbolRaw.toUpperCase() || DEFAULT_SYMBOL;

	const periodKey = p.get("period") ?? PERIOD_TO_KEY[DEFAULT_PERIOD];
	const period = PERIOD_FROM_KEY[periodKey] ?? DEFAULT_PERIOD;

	const chartKey = p.get("chart") ?? CHART_TO_KEY[DEFAULT_CHART] ?? "area";
	const chartType = (CHART_FROM_KEY[chartKey] ?? DEFAULT_CHART) as ChartType;

	const dateRaw = p.get("date");
	let endDate: Date | undefined;
	if (dateRaw) {
		const d = new Date(dateRaw);
		if (!Number.isNaN(d.getTime()) && d < new Date()) {
			endDate = d;
		}
	}

	const showVolume = p.get("vol") === "1";

	const themeRaw = p.get("theme");
	const themeMode: ThemeMode =
		themeRaw === "dark" || themeRaw === "light" ? themeRaw : "auto";

	return { symbol, period, chartType, endDate, showVolume, themeMode };
}

export function writeParams(
	symbol: string,
	period: PeriodLabel,
	chartType: ChartType,
	endDate: Date | undefined,
	showVolume: boolean,
	themeMode: ThemeMode,
): void {
	const p = new URLSearchParams();
	p.set("symbol", symbol);
	p.set("period", PERIOD_TO_KEY[period]);
	p.set("chart", CHART_TO_KEY[chartType] ?? chartType);
	if (endDate) p.set("date", endDate.toISOString().slice(0, 10));
	if (showVolume) p.set("vol", "1");
	if (themeMode !== "auto") p.set("theme", themeMode);
	const newSearch = `?${p.toString()}`;
	if (window.location.search !== newSearch) {
		window.history.replaceState(null, "", newSearch);
	}
}
