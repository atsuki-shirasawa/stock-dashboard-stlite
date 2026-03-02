import { ArrowDown, ArrowUp } from "lucide-react";
import {
	DELTA_LABELS,
	DOWN_COLOR,
	DOWN_FILL,
	SUBTEXT_COLOR,
	TEXT_COLOR,
	UP_COLOR,
	UP_FILL,
} from "../constants";
import type { OHLCVRow, StockMeta } from "../types/stock";

interface PriceHeaderProps {
	symbol: string;
	meta: StockMeta;
	rows: OHLCVRow[];
	periodLabel: string;
}

export default function PriceHeader({
	symbol,
	meta,
	rows,
	periodLabel,
}: PriceHeaderProps) {
	if (rows.length === 0) return null;

	const latest = rows[rows.length - 1]!.close;
	const deltaLabel = DELTA_LABELS[periodLabel] ?? "vs prev day";

	// Period-based baseline: arrow direction, delta value, label (original behavior)
	const prevPeriod =
		periodLabel === "1D"
			? (meta.previousClose ?? rows[0]!.close)
			: rows[0]!.close;

	// Color-only baseline: matches chart area color (same as StockChart)
	const prevColor =
		meta.previousClose ?? rows[rows.length - 2]?.close ?? rows[0]!.close;

	const delta = latest - prevPeriod;
	const deltaPct = prevPeriod !== 0 ? (delta / prevPeriod) * 100 : 0;
	const isUp = delta >= 0;
	const isUpColor = latest >= prevColor;
	const color = isUpColor ? UP_COLOR : DOWN_COLOR;
	const sign = isUp ? "+" : "";

	const currency = meta.currency ?? "";
	const currencyStr = currency ? ` ${currency}` : "";
	const name = meta.shortName ?? symbol;
	const isJpy = currency === "JPY";
	const digits = isJpy ? 0 : 2;

	return (
		<div style={{ marginBottom: 2 }}>
			<div
				style={{
					fontSize: "clamp(14px, 1.2vw, 16px)",
					color: SUBTEXT_COLOR,
					marginBottom: 1,
				}}
			>
				{name}
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
				<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<span
						style={{
							fontSize: "clamp(18px, 2.4vw, 32px)",
							fontWeight: 700,
							color: TEXT_COLOR,
						}}
					>
						{latest.toLocaleString(undefined, {
							minimumFractionDigits: digits,
							maximumFractionDigits: digits,
						})}
						{currencyStr}
					</span>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: 28,
							height: 28,
							borderRadius: 8,
							background: isUpColor ? UP_FILL : DOWN_FILL,
							flexShrink: 0,
						}}
					>
						{isUp ? (
							<ArrowUp size={16} strokeWidth={2.5} color={color} />
						) : (
							<ArrowDown size={16} strokeWidth={2.5} color={color} />
						)}
					</span>
				</span>
				<span
					style={{
						fontSize: "clamp(11px, 1.2vw, 14px)",
						color,
						display: "flex",
						alignItems: "center",
						gap: 4,
					}}
				>
					<span>
						{sign}
						{delta.toLocaleString(undefined, {
							minimumFractionDigits: digits,
							maximumFractionDigits: digits,
						})}
						{currencyStr}&nbsp;({sign}
						{deltaPct.toFixed(2)}%)
					</span>
					<span style={{ fontSize: 12, color: SUBTEXT_COLOR }}>
						{deltaLabel}
					</span>
				</span>
			</div>
		</div>
	);
}
