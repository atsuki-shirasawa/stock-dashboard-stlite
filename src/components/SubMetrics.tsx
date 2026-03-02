import { SUBTEXT_COLOR, TEXT_COLOR } from "../constants";
import type { OHLCVRow, StockMeta } from "../types/stock";

interface SubMetricsProps {
	rows: OHLCVRow[];
	meta: StockMeta;
}

interface MetricItem {
	label: string;
	value: string;
}

function fmt(n: number, isJpy: boolean): string {
	const digits = isJpy ? 0 : 2;
	return n.toLocaleString(undefined, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
}

export default function SubMetrics({ rows, meta }: SubMetricsProps) {
	if (rows.length === 0) return null;

	const isJpy = meta.currency === "JPY";
	const periodHigh = Math.max(...rows.map((r) => r.high));
	const periodLow = Math.min(...rows.map((r) => r.low));
	const latestVolume = rows[rows.length - 1]!.volume;

	const items: MetricItem[] = [
		{ label: "Period High", value: fmt(periodHigh, isJpy) },
		{ label: "Period Low", value: fmt(periodLow, isJpy) },
		{ label: "Latest Volume", value: latestVolume.toLocaleString() },
		{
			label: "52W High",
			value:
				meta.fiftyTwoWeekHigh != null ? fmt(meta.fiftyTwoWeekHigh, isJpy) : "—",
		},
		{
			label: "52W Low",
			value:
				meta.fiftyTwoWeekLow != null ? fmt(meta.fiftyTwoWeekLow, isJpy) : "—",
		},
	];

	return (
		<div
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: "8px 24px",
				padding: "6px 4px 4px",
				borderTop: "1px solid rgba(100,116,139,0.15)",
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
