import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChart } from "./api/yahooFinance";
import PeriodSelector from "./components/PeriodSelector";
import PriceHeader from "./components/PriceHeader";
import StockChart from "./components/StockChart";
import SubMetrics from "./components/SubMetrics";
import {
	BG,
	DOWN_COLOR,
	ERROR_BG,
	ERROR_BORDER,
	SUBTEXT_COLOR,
	TEXT_COLOR,
} from "./constants";
import type { ChartData, PeriodLabel } from "./types/stock";
import { getColorBaseline } from "./utils/baseline";
import { readParams, writeParams } from "./utils/urlParams";

export default function App() {
	const [{ symbol, chartType, endDate, showVolume, period: initPeriod }] =
		useState(readParams);
	const [period, setPeriod] = useState<PeriodLabel>(initPeriod);

	const [data, setData] = useState<ChartData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const abortRef = useRef<AbortController | null>(null);

	const load = useCallback(async (sym: string, per: PeriodLabel, ed?: Date) => {
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

	const isUp = data
		? (data.meta.regularMarketPrice ??
				data.rows[data.rows.length - 1]?.close ??
				0) >= getColorBaseline(data.rows, data.meta.previousClose)
		: true;

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
						<div style={{ flexShrink: 0, marginBottom: 6 }}>
							<div
								style={{
									display: "flex",
									alignItems: "baseline",
									gap: 6,
									flexWrap: "wrap",
								}}
							>
								<span
									style={{
										fontSize: "clamp(14px, 1.2vw, 16px)",
										color: SUBTEXT_COLOR,
									}}
								>
									{data.meta.longName
										? `${data.meta.longName} (${symbol})`
										: (data.meta.shortName ?? symbol)}
								</span>
								{[data.meta.exchangeName, data.meta.timezone]
									.filter(Boolean)
									.join(" · ") && (
									<span
										style={{
											fontSize: 11,
											color: SUBTEXT_COLOR,
											opacity: 0.6,
										}}
									>
										{[data.meta.exchangeName, data.meta.timezone]
											.filter(Boolean)
											.join(" · ")}
									</span>
								)}
								{data.meta.regularMarketTime != null && (
									<span
										style={{
											fontSize: 11,
											color: SUBTEXT_COLOR,
											opacity: 0.6,
										}}
									>
										· Updated{" "}
										{new Date(data.meta.regularMarketTime).toLocaleTimeString(
											"en-US",
											{
												...(data.meta.exchangeTimezoneName
													? { timeZone: data.meta.exchangeTimezoneName }
													: {}),
												hour: "2-digit",
												minute: "2-digit",
												hour12: false,
											},
										)}
										{data.meta.timezone ? ` ${data.meta.timezone}` : ""}
									</span>
								)}
							</div>
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								flexShrink: 0,
							}}
						>
							<PriceHeader
								meta={data.meta}
								latestClose={data.rows[data.rows.length - 1]!.close}
								firstClose={data.rows[0]!.close}
								periodLabel={period}
							/>
							<PeriodSelector value={period} onChange={setPeriod} isUp={isUp} />
						</div>
						<div style={{ flex: 1, minHeight: 0, maxHeight: 560 }}>
							<StockChart
								rows={data.rows}
								symbol={symbol}
								periodLabel={period}
								chartType={chartType}
								showVolume={showVolume}
								previousClose={data.meta.previousClose}
								regularMarketPrice={data.meta.regularMarketPrice}
								sessionStart={data.meta.regularMarketOpen}
								sessionEnd={data.meta.regularMarketClose}
								currency={data.meta.currency}
								exchangeTimezoneName={data.meta.exchangeTimezoneName}
							/>
						</div>
						<SubMetrics rows={data.rows} meta={data.meta} />
					</>
				)}
			</div>
		</div>
	);
}
