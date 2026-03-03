import type { Data, Layout, LayoutAxis, RangeBreak } from "plotly.js";
import PlotlyInstance from "plotly.js-finance-dist";

import createPlotlyComponent from "react-plotly.js/factory";
import {
	BG,
	DOWN_COLOR,
	DOWN_FILL_GRAD_BOT,
	DOWN_FILL_GRAD_TOP,
	FONT_FAMILY,
	GRID_COLOR,
	HOVER_BORDER,
	PANEL_BG,
	SPIKE_COLOR,
	SUBTEXT_COLOR,
	TEXT_COLOR,
	UP_COLOR,
	UP_FILL_GRAD_BOT,
	UP_FILL_GRAD_TOP,
	VOL_DOWN,
	VOL_UP,
} from "../constants";
import type { ChartType, OHLCVRow, PeriodLabel } from "../types/stock";
import { getColorBaseline } from "../utils/baseline";

const Plot = createPlotlyComponent(PlotlyInstance);

interface StockChartProps {
	rows: OHLCVRow[];
	symbol: string;
	periodLabel: PeriodLabel;
	chartType: ChartType;
	showVolume: boolean;
	previousClose?: number;
	regularMarketPrice?: number; // 現在の市場価格（色判定用）
	sessionStart?: number; // Unix ms — used for 1D x-axis range
	sessionEnd?: number; // Unix ms — used for 1D x-axis range
	currency?: string;
	exchangeTimezoneName?: string; // e.g. "Asia/Tokyo", "America/New_York"
}

/** Unix ms → "YYYY-MM-DD" in exchange timezone (falls back to local if tz undefined) */
function tzDate(ts: number, tz?: string): string {
	const opts: Intl.DateTimeFormatOptions = tz ? { timeZone: tz } : {};
	return new Date(ts).toLocaleDateString("sv", opts);
}

/** Unix ms → "YYYY-MM-DD HH:MM:SS" in exchange timezone.
 * Passed to Plotly without a TZ suffix — Plotly treats it as display-local time,
 * which is what we want (the string itself represents exchange-local clock time). */
function tzDateStr(ts: number, tz?: string): string {
	const d = new Date(ts);
	const opts: Intl.DateTimeFormatOptions = tz ? { timeZone: tz } : {};
	const date = d.toLocaleDateString("sv", opts); // "YYYY-MM-DD"
	const time = d.toLocaleTimeString("sv", { ...opts, hour12: false }); // "HH:MM:SS"
	return `${date} ${time}`;
}

/**
 * Build rangebreaks based on interval type:
 *  - daily intervals (1M/6M/1Y): enumerate missing dates (≤~250 entries)
 *  - weekly interval (5Y): just skip weekends via bounds — efficient
 *  - monthly interval (10Y): no rangebreaks needed
 */
function getRangebreaks(
	rows: OHLCVRow[],
	periodLabel: PeriodLabel,
	tz?: string,
): Partial<RangeBreak>[] {
	if (rows.length === 0) return [];

	// Weekly / monthly data — gaps are expected and visually acceptable; skip breaks
	if (periodLabel === "5Y" || periodLabel === "10Y") return [];

	// Daily data — enumerate missing calendar days (non-trading days) in exchange TZ
	const tradingDays = new Set(rows.map((r) => tzDate(r.timestamp, tz)));

	const firstRow = rows[0];
	const lastRow = rows[rows.length - 1];
	if (!firstRow || !lastRow) return [];

	// Use UTC-based iteration so local DST shifts don't cause off-by-one errors
	const firstStr = tzDate(firstRow.timestamp, tz);
	const lastStr = tzDate(lastRow.timestamp, tz);
	const cur = new Date(`${firstStr}T00:00:00Z`);
	const end = new Date(`${lastStr}T00:00:00Z`);

	const missing: string[] = [];
	while (cur <= end) {
		const key = cur.toISOString().slice(0, 10);
		if (!tradingDays.has(key)) missing.push(key);
		cur.setUTCDate(cur.getUTCDate() + 1);
	}

	return missing.length === 0 ? [] : [{ values: missing }];
}

function buildCandlestickTrace(
	rows: OHLCVRow[],
	xs: (string | number)[],
	symbol: string,
): Data {
	return {
		type: "candlestick",
		x: xs,
		open: rows.map((r) => r.open),
		high: rows.map((r) => r.high),
		low: rows.map((r) => r.low),
		close: rows.map((r) => r.close),
		increasing: { line: { color: UP_COLOR, width: 1 }, fillcolor: UP_COLOR },
		decreasing: {
			line: { color: DOWN_COLOR, width: 1 },
			fillcolor: DOWN_COLOR,
		},
		name: symbol,
		hoverlabel: { bgcolor: PANEL_BG, bordercolor: HOVER_BORDER },
	} as Data;
}

function buildAreaTraces(
	rows: OHLCVRow[],
	xs: (string | number)[],
	symbol: string,
	baseline: number,
	priceHoverFormat = "%{y:,.2f}",
	marketPrice?: number,
): Data[] {
	const last = marketPrice ?? rows[rows.length - 1]?.close ?? 0;
	const isUp = last >= baseline;
	const lineColor = isUp ? UP_COLOR : DOWN_COLOR;
	const gradTop = isUp ? UP_FILL_GRAD_TOP : DOWN_FILL_GRAD_TOP;
	const gradBot = isUp ? UP_FILL_GRAD_BOT : DOWN_FILL_GRAD_BOT;
	const base = Math.min(...rows.map((r) => r.close)) * 0.998;

	const baseTrace: Data = {
		type: "scatter",
		x: xs,
		y: rows.map(() => base),
		mode: "lines",
		line: { width: 0, color: "rgba(0,0,0,0)" },
		showlegend: false,
		hoverinfo: "skip",
	} as Data;

	const areaTrace: Data = {
		type: "scatter",
		x: xs,
		y: rows.map((r) => r.close),
		mode: "lines",
		name: symbol,
		line: { color: lineColor, width: 1.5 },
		fill: "tonexty",
		fillgradient: {
			type: "vertical",
			colorscale: [
				[0, gradBot],
				[1, gradTop],
			],
		},
		hovertemplate: `<b>%{x}</b><br>Close: ${priceHoverFormat}<extra>${symbol}</extra>`,
	} as Data;

	return [baseTrace, areaTrace];
}

function buildVolumeTrace(rows: OHLCVRow[], xs: (string | number)[]): Data {
	const colors = rows.map((r) => (r.close >= r.open ? VOL_UP : VOL_DOWN));
	return {
		type: "bar",
		x: xs,
		y: rows.map((r) => r.volume),
		name: "Volume",
		marker: { color: colors, line: { width: 0 } },
		showlegend: false,
		hovertemplate: "Volume: %{y:,.0f}<extra></extra>",
		yaxis: "y2",
	} as Data;
}

interface LayoutParams {
	rows: OHLCVRow[];
	periodLabel: PeriodLabel;
	showVolume: boolean;
	priceTickFormat: string;
	sessionStart?: number;
	sessionEnd?: number;
	xs: string[];
	tz?: string;
}

function buildLayout({
	rows,
	periodLabel,
	showVolume,
	priceTickFormat,
	sessionStart,
	sessionEnd,
	xs,
	tz,
}: LayoutParams): Partial<Layout> {
	const useCategory = periodLabel === "1W";

	const xAxisCommon: Partial<LayoutAxis> = {
		showgrid: false,
		zeroline: false,
		showspikes: true,
		spikecolor: SPIKE_COLOR,
		spikethickness: 1,
		spikedash: "dot",
		spikesnap: "cursor",
		tickfont: { color: SUBTEXT_COLOR, size: 11 },
	};

	const sessionRange =
		periodLabel === "1D" && sessionStart && sessionEnd
			? ([tzDateStr(sessionStart, tz), tzDateStr(sessionEnd, tz)] as [
					string,
					string,
				])
			: undefined;

	const weeklyTicks = useCategory ? buildWeeklyTicks(rows, xs, tz) : null;

	const xAxisExtra: Partial<LayoutAxis> = useCategory
		? {
				type: "category",
				tickvals: weeklyTicks!.vals,
				ticktext: weeklyTicks!.texts,
			}
		: {
				rangebreaks: getRangebreaks(rows, periodLabel, tz),
				...(sessionRange ? { range: sessionRange } : {}),
			};

	const yAxisCommon: Partial<LayoutAxis> = {
		gridcolor: GRID_COLOR,
		zeroline: false,
		showspikes: false,
		tickfont: { color: SUBTEXT_COLOR, size: 11 },
		tickformat: priceTickFormat,
		side: "right",
		title: { text: "" },
	};

	return {
		xaxis: { ...xAxisCommon, ...xAxisExtra, rangeslider: { visible: false } },
		yaxis: {
			...yAxisCommon,
			domain: showVolume ? [0.3, 1] : [0, 1],
		},
		...(showVolume
			? {
					yaxis2: {
						...yAxisCommon,
						domain: [0, 0.26],
						side: "right",
					},
				}
			: {}),
		autosize: true,
		margin: { t: 32, b: 32, l: 12, r: 60 },
		plot_bgcolor: BG,
		paper_bgcolor: BG,
		font: { color: TEXT_COLOR, family: FONT_FAMILY, size: 12 },
		hovermode: "x unified",
		hoverlabel: {
			bgcolor: PANEL_BG,
			bordercolor: HOVER_BORDER,
			font: { color: TEXT_COLOR, size: 12, family: FONT_FAMILY },
		},
		showlegend: false,
	};
}

/** 1W用: 各日の最初のデータポイントだけtickを立てる */
function buildWeeklyTicks(
	rows: OHLCVRow[],
	xs: string[],
	tz?: string,
): { vals: string[]; texts: string[] } {
	const seen = new Set<string>();
	const vals: string[] = [];
	const texts: string[] = [];
	for (let i = 0; i < rows.length; i++) {
		const key = tzDate(rows[i]!.timestamp, tz);
		if (!seen.has(key)) {
			seen.add(key);
			vals.push(xs[i]!);
			texts.push(
				new Date(rows[i]!.timestamp).toLocaleDateString("en-US", {
					...(tz ? { timeZone: tz } : {}),
					month: "short",
					day: "numeric",
				}),
			);
		}
	}
	return { vals, texts };
}

export default function StockChart({
	rows,
	symbol,
	periodLabel,
	chartType,
	showVolume,
	previousClose,
	regularMarketPrice,
	sessionStart,
	sessionEnd,
	currency,
	exchangeTimezoneName,
}: StockChartProps) {
	if (rows.length === 0) return null;

	const isJpy = currency === "JPY";
	const priceTickFormat = isJpy ? ",.0f" : ",.2f";
	const priceHoverFormat = isJpy ? "%{y:,.0f}" : "%{y:,.2f}";
	const tz = exchangeTimezoneName;

	// Format in exchange timezone; no "Z" suffix → Plotly treats as display-local time
	const xs = rows.map((r) => tzDateStr(r.timestamp, tz));

	const baseline = getColorBaseline(rows, previousClose);
	const priceTraces: Data[] =
		chartType === "Area"
			? buildAreaTraces(
					rows,
					xs,
					symbol,
					baseline,
					priceHoverFormat,
					regularMarketPrice,
				)
			: [buildCandlestickTrace(rows, xs, symbol)];

	const traces: Data[] = showVolume
		? [...priceTraces, buildVolumeTrace(rows, xs)]
		: priceTraces;

	const layout = buildLayout({
		rows,
		periodLabel,
		showVolume,
		priceTickFormat,
		sessionStart,
		sessionEnd,
		xs,
		tz,
	});

	return (
		<Plot
			data={traces}
			layout={layout}
			config={{ responsive: true, displayModeBar: false }}
			style={{ width: "100%", height: "100%" }}
			useResizeHandler
		/>
	);
}
