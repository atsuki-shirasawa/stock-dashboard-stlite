import { ArrowDown, ArrowUp } from "lucide-react";
import { DELTA_LABELS } from "../constants";
import { useTheme } from "../context/theme";
import type { PeriodLabel, StockMeta } from "../types/stock";
import { formatPrice } from "../utils/formatPrice";

interface PriceHeaderProps {
	meta: StockMeta;
	latestClose: number;
	firstClose: number;
	periodLabel: PeriodLabel;
}

export default function PriceHeader({
	meta,
	latestClose,
	firstClose,
	periodLabel,
}: PriceHeaderProps) {
	const {
		DOWN_COLOR,
		DOWN_FILL,
		SUBTEXT_COLOR,
		TEXT_COLOR,
		UP_COLOR,
		UP_FILL,
	} = useTheme();
	const deltaLabel = DELTA_LABELS[periodLabel];

	const prevPeriod =
		periodLabel === "1D" ? (meta.previousClose ?? firstClose) : firstClose;

	const marketPrice = meta.regularMarketPrice ?? latestClose;
	const prevColor = meta.previousClose ?? latestClose;

	const delta = latestClose - prevPeriod;
	const deltaPct = prevPeriod !== 0 ? (delta / prevPeriod) * 100 : 0;
	const isArrowUp = delta >= 0;
	const isUpColor = marketPrice >= prevColor;
	const color = isUpColor ? UP_COLOR : DOWN_COLOR;
	const sign = isArrowUp ? "+" : "";

	const currency = meta.currency ?? "";
	const currencyStr = currency ? ` ${currency}` : "";
	const isJpy = currency === "JPY";

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
			<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<span
					style={{
						fontSize: "clamp(18px, 2.4vw, 32px)",
						fontWeight: 700,
						color: TEXT_COLOR,
					}}
				>
					{formatPrice(latestClose, isJpy)}
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
					{isArrowUp ? (
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
					{formatPrice(delta, isJpy)}
					{currencyStr}&nbsp;({sign}
					{deltaPct.toFixed(2)}%)
				</span>
				<span style={{ fontSize: 12, color: SUBTEXT_COLOR }}>{deltaLabel}</span>
			</span>
		</div>
	);
}
