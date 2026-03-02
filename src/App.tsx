import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChart } from "./api/yahooFinance";
import PeriodSelector from "./components/PeriodSelector";
import PriceHeader from "./components/PriceHeader";
import StockChart from "./components/StockChart";
import SubMetrics from "./components/SubMetrics";
import {
	BG,
	CHART_FROM_KEY,
	CHART_TO_KEY,
	DEFAULT_CHART,
	DEFAULT_PERIOD,
	DEFAULT_SYMBOL,
	DOWN_COLOR,
	ERROR_BG,
	ERROR_BORDER,
	PERIOD_FROM_KEY,
	PERIOD_TO_KEY,
	SUBTEXT_COLOR,
	TEXT_COLOR,
} from "./constants";
import type { ChartData, ChartType } from "./types/stock";

// ── URL param helpers ──────────────────────────────────────────────────
function readParams() {
	const p = new URLSearchParams(window.location.search);
	const symbolRaw = p.get("symbol") ?? DEFAULT_SYMBOL;
	const symbol = symbolRaw.toUpperCase() || DEFAULT_SYMBOL;

	const periodKey = p.get("period") ?? PERIOD_TO_KEY[DEFAULT_PERIOD] ?? "1y";
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

	return { symbol, period, chartType, endDate, showVolume };
}

function writeParams(
	symbol: string,
	period: string,
	chartType: ChartType,
	endDate: Date | undefined,
	showVolume: boolean,
) {
	const p = new URLSearchParams();
	p.set("symbol", symbol);
	p.set("period", PERIOD_TO_KEY[period] ?? period);
	p.set("chart", CHART_TO_KEY[chartType] ?? chartType);
	if (endDate) p.set("date", endDate.toISOString().slice(0, 10));
	if (showVolume) p.set("vol", "1");
	const newSearch = `?${p.toString()}`;
	if (window.location.search !== newSearch) {
		window.history.replaceState(null, "", newSearch);
	}
}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
	const [{ symbol, chartType, endDate, showVolume, period: initPeriod }] =
		useState(readParams);
	const [period, setPeriod] = useState(initPeriod);

	const [data, setData] = useState<ChartData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const abortRef = useRef<AbortController | null>(null);

	const load = useCallback(async (sym: string, per: string, ed?: Date) => {
		abortRef.current?.abort();
		abortRef.current = new AbortController();
		setLoading(true);
		setError(null);
		try {
			const result = await fetchChart(sym, per, ed, abortRef.current.signal);
			if (result.rows.length === 0) {
				setError(`No data found for ${sym}. Please check the ticker symbol.`);
				setData(null);
			} else {
				setData(result);
			}
		} catch (e) {
			if (e instanceof Error && e.name !== "AbortError") {
				setError(`Failed to fetch data: ${e.message}`);
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load(symbol, period, endDate);
	}, [symbol, period, endDate, load]);

	useEffect(() => {
		writeParams(symbol, period, chartType, endDate, showVolume);
	}, [symbol, period, chartType, endDate, showVolume]);

	return (
		<div
			style={{
				height: "100vh",
				background: BG,
				color: TEXT_COLOR,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{/* Content */}
			<div
				style={{
					padding: "20px 16px 20px",
					flex: 1,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					minHeight: 0,
				}}
			>
				{loading && (
					<div
						style={{ color: SUBTEXT_COLOR, fontSize: 14, padding: "20px 0" }}
					>
						Fetching data for {symbol}…
					</div>
				)}

				{error && !loading && (
					<div
						style={{
							color: DOWN_COLOR,
							background: ERROR_BG,
							border: `1px solid ${ERROR_BORDER}`,
							borderRadius: 8,
							padding: "12px 16px",
							fontSize: 14,
							marginBottom: 8,
						}}
					>
						{error}
					</div>
				)}

				{data && !loading && (
					<>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								flexShrink: 0,
							}}
						>
							<PriceHeader
								symbol={symbol}
								meta={data.meta}
								rows={data.rows}
								periodLabel={period}
							/>
							<PeriodSelector value={period} onChange={setPeriod} />
						</div>
						<div style={{ flex: 1, minHeight: 0, maxHeight: 560 }}>
							<StockChart
								rows={data.rows}
								symbol={symbol}
								periodLabel={period}
								chartType={chartType}
								showVolume={showVolume}
							/>
						</div>
						<SubMetrics rows={data.rows} meta={data.meta} />
					</>
				)}
			</div>
		</div>
	);
}
