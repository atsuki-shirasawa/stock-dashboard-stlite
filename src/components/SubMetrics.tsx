import { DIVIDER_COLOR, SUBTEXT_COLOR, TEXT_COLOR } from "../constants";
import type { OHLCVRow, StockMeta } from "../types/stock";
import { formatPrice } from "../utils/formatPrice";

interface SubMetricsProps {
	rows: OHLCVRow[];
	meta: StockMeta;
}

interface MetricItem {
	label: string;
	value: string;
}

export default function SubMetrics({ rows, meta }: SubMetricsProps) {
	if (rows.length === 0) return null;

	const isJpy = meta.currency === "JPY";
	const periodHigh = rows.reduce((acc, r) => Math.max(acc, r.high), -Infinity);
	const periodLow = rows.reduce((acc, r) => Math.min(acc, r.low), Infinity);
	// regularMarketVolume は当日累計出来高（最終バーより正確）、なければ最終バーで代替
	const dailyVolume = meta.regularMarketVolume ?? rows[rows.length - 1]!.volume;

	const items: MetricItem[] = [
		{ label: "Period High", value: formatPrice(periodHigh, isJpy) },
		{ label: "Period Low", value: formatPrice(periodLow, isJpy) },
		...(meta.regularMarketDayHigh != null
			? [
					{
						label: "Day High",
						value: formatPrice(meta.regularMarketDayHigh, isJpy),
					},
				]
			: []),
		...(meta.regularMarketDayLow != null
			? [
					{
						label: "Day Low",
						value: formatPrice(meta.regularMarketDayLow, isJpy),
					},
				]
			: []),
		{ label: "Daily Vol", value: dailyVolume.toLocaleString() },
		{
			label: "52W High",
			value:
				meta.fiftyTwoWeekHigh != null
					? formatPrice(meta.fiftyTwoWeekHigh, isJpy)
					: "—",
		},
		{
			label: "52W Low",
			value:
				meta.fiftyTwoWeekLow != null
					? formatPrice(meta.fiftyTwoWeekLow, isJpy)
					: "—",
		},
	];

	return (
		<div
			style={{
				display: "flex",
				flexWrap: "nowrap",
				gap: "clamp(6px, 2vw, 24px)",
				padding: "6px 4px 4px",
				borderTop: `1px solid ${DIVIDER_COLOR}`,
				overflow: "hidden",
			}}
		>
			{items.map(({ label, value }) => (
				<div
					key={label}
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 2,
						flex: "1 1 0",
						minWidth: 0,
					}}
				>
					<span
						style={{
							fontSize: "clamp(7px, 1.4vw, 11px)",
							color: SUBTEXT_COLOR,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{label}
					</span>
					<span
						style={{
							fontSize: "clamp(8px, 1.6vw, 13px)",
							color: TEXT_COLOR,
							fontWeight: 500,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{value}
					</span>
				</div>
			))}
		</div>
	);
}
