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
	const latestVolume = rows[rows.length - 1]!.volume;

	const items: MetricItem[] = [
		{ label: "Period High", value: formatPrice(periodHigh, isJpy) },
		{ label: "Period Low", value: formatPrice(periodLow, isJpy) },
		{ label: "Latest Volume", value: latestVolume.toLocaleString() },
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
				flexWrap: "wrap",
				gap: "8px 24px",
				padding: "6px 4px 4px",
				borderTop: `1px solid ${DIVIDER_COLOR}`,
			}}
		>
			{items.map(({ label, value }) => (
				<div
					key={label}
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 2,
						minWidth: 80,
					}}
				>
					<span
						style={{
							fontSize: 11,
							color: SUBTEXT_COLOR,
							whiteSpace: "nowrap",
						}}
					>
						{label}
					</span>
					<span
						style={{
							fontSize: 13,
							color: TEXT_COLOR,
							fontWeight: 500,
							whiteSpace: "nowrap",
						}}
					>
						{value}
					</span>
				</div>
			))}
		</div>
	);
}
