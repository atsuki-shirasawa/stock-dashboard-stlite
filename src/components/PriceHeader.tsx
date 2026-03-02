import { ArrowDown, ArrowUp } from "lucide-react";
import {
	DELTA_LABELS,
	DOWN_COLOR,
	FONT_FAMILY,
	SUBTEXT_COLOR,
	TEXT_COLOR,
	UP_COLOR,
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

	let prev: number;
	if (periodLabel === "1D") {
		prev = meta.previousClose ?? rows[0]!.close;
	} else {
		prev = rows[0]!.close;
	}

	const delta = latest - prev;
	const deltaPct = prev !== 0 ? (delta / prev) * 100 : 0;
	const isUp = delta >= 0;
	const color = isUp ? UP_COLOR : DOWN_COLOR;
	const sign = isUp ? "+" : "";

	const currency = meta.currency ?? "";
	const currencyStr = currency ? ` ${currency}` : "";
	const name = meta.shortName ?? symbol;

	const fmtDate = (ts: number) => {
		const d = new Date(ts);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}/${m}/${day}`;
	};
	const dateRange = `${fmtDate(rows[0]!.timestamp)} 〜 ${fmtDate(rows[rows.length - 1]!.timestamp)}`;

	return (
		<div style={{ marginBottom: 2 }}>
			<div
				style={{
					fontSize: "clamp(12px, 1.2vw, 16px)",
					color: SUBTEXT_COLOR,
					marginBottom: 1,
					fontFamily: FONT_FAMILY,
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
							fontFamily: FONT_FAMILY,
						}}
					>
						{latest.toLocaleString(undefined, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
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
							background: isUp
								? "rgba(16,185,129,0.12)"
								: "rgba(239,68,68,0.10)",
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
						fontFamily: FONT_FAMILY,
						display: "flex",
						alignItems: "center",
						gap: 4,
					}}
				>
					<span>
						{sign}
						{delta.toFixed(2)}
						{currencyStr}&nbsp;({sign}
						{deltaPct.toFixed(2)}%)
					</span>
					<span style={{ fontSize: 12, color: SUBTEXT_COLOR }}>
						{deltaLabel}
					</span>
				</span>
				<span
					style={{
						fontSize: "clamp(10px, 1.0vw, 13px)",
						color: SUBTEXT_COLOR,
						fontFamily: FONT_FAMILY,
					}}
				>
					{dateRange}
				</span>
			</div>
		</div>
	);
}
