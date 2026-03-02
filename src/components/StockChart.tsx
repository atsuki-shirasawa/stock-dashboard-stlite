import type { Data, Layout, LayoutAxis, RangeBreak } from "plotly.js";
import PlotlyInstance from "plotly.js-finance-dist";

import createPlotlyComponent from "react-plotly.js/factory";
import {
	BG,
	DOWN_COLOR,
	DOWN_FILL,
	FONT_FAMILY,
	GRID_COLOR,
	HOVER_BORDER,
	PANEL_BG,
	SPIKE_COLOR,
	SUBTEXT_COLOR,
	TEXT_COLOR,
	UP_COLOR,
	UP_FILL,
	VOL_DOWN,
	VOL_UP,
} from "../constants";
import type { ChartType, OHLCVRow } from "../types/stock";

const Plot = createPlotlyComponent(PlotlyInstance);

interface StockChartProps {
	rows: OHLCVRow[];
	symbol: string;
	periodLabel: string;
	chartType: ChartType;
	showVolume: boolean;
	previousClose?: number;
	sessionStart?: number; // Unix ms — used for 1D x-axis range
	sessionEnd?: number; // Unix ms — used for 1D x-axis range
}

/**
 * Build rangebreaks based on interval type:
 *  - daily intervals (1M/6M/1Y): enumerate missing dates (≤~250 entries)
 *  - weekly interval (5Y): just skip weekends via bounds — efficient
 *  - monthly interval (10Y): no rangebreaks needed
 */
function getRangebreaks(
	rows: OHLCVRow[],
	periodLabel: string,
): Partial<RangeBreak>[] {
	if (rows.length === 0) return [];

	// Weekly / monthly data — gaps are expected and visually acceptable; skip breaks
	if (periodLabel === "5Y" || periodLabel === "10Y") return [];

	// Daily data — enumerate missing calendar days (non-trading days)
	const fmt = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

	const tradingDays = new Set(rows.map((r) => fmt(new Date(r.timestamp))));

	const firstRow = rows[0];
	const lastRow = rows[rows.length - 1];
	if (!firstRow || !lastRow) return [];
	const first = new Date(firstRow.timestamp);
	const last = new Date(lastRow.timestamp);
	first.setHours(0, 0, 0, 0);
	last.setHours(0, 0, 0, 0);

	const missing: string[] = [];
	const cur = new Date(first);
	while (cur <= last) {
		const key = fmt(cur);
		if (!tradingDays.has(key)) missing.push(key);
		cur.setDate(cur.getDate() + 1);
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
	previousClose?: number,
): Data[] {
	// previousClose: from meta (intraday 1D/1W only)
	// rows[length-2].close: previous bar's close for daily/weekly/monthly intervals
	const baseline = previousClose ?? rows[rows.length - 2]?.close ?? rows[0]?.close ?? 0;
	const last = rows[rows.length - 1]?.close ?? 0;
	const isUp = last >= baseline;
	const lineColor = isUp ? UP_COLOR : DOWN_COLOR;
	const fillColor = isUp ? UP_FILL : DOWN_FILL;
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
		line: { color: lineColor, width: 2 },
		fill: "tonexty",
		fillcolor: fillColor,
		hovertemplate: `<b>%{x}</b><br>Close: %{y:,.2f}<extra>${symbol}</extra>`,
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

/** Format a Unix-ms timestamp as "YYYY-MM-DD HH:MM:SS" in the browser's local timezone.
 * Plotly.js interprets strings without a timezone suffix as local time. */
function toLocalDateStr(ts: number): string {
	const d = new Date(ts);
	const p = (n: number, w = 2) => String(n).padStart(w, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function StockChart({
	rows,
	symbol,
	periodLabel,
	chartType,
	showVolume,
	previousClose,
	sessionStart,
	sessionEnd,
}: StockChartProps) {
	if (rows.length === 0) return null;

	// For 1W use categorical x-axis labels to avoid overnight gaps
	const useCategory = periodLabel === "1W";
	// Always format in local timezone (no "Z" suffix = Plotly treats as local time)
	const xs = rows.map((r) => toLocalDateStr(r.timestamp));

	const priceTraces: Data[] =
		chartType === "Area"
			? buildAreaTraces(rows, xs, symbol, previousClose)
			: [buildCandlestickTrace(rows, xs, symbol)];

	const traces: Data[] = showVolume
		? [...priceTraces, buildVolumeTrace(rows, xs)]
		: priceTraces;

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

	// For 1D: fix x-axis to the full trading session so the right side doesn't
	// collapse to the last data point during an active trading day.
	const sessionRange =
		periodLabel === "1D" && sessionStart && sessionEnd
			? ([toLocalDateStr(sessionStart), toLocalDateStr(sessionEnd)] as [
					string,
					string,
				])
			: undefined;

	const xAxisExtra: Partial<LayoutAxis> = useCategory
		? { type: "category", nticks: 6 }
		: {
				rangebreaks: getRangebreaks(rows, periodLabel),
				...(sessionRange ? { range: sessionRange } : {}),
			};

	const yAxisCommon: Partial<LayoutAxis> = {
		gridcolor: GRID_COLOR,
		zeroline: false,
		showspikes: false,
		tickfont: { color: SUBTEXT_COLOR, size: 11 },
		side: "right",
		title: { text: "" },
	};

	const layout: Partial<Layout> = {
		title: { text: "" },
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
		margin: { t: 8, b: 20, l: 12, r: 60 },
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
