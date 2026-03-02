import { DELTA_LABELS, DOWN_COLOR, SUBTEXT_COLOR, TEXT_COLOR, UP_COLOR } from "../constants";
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

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontSize: 13,
          color: SUBTEXT_COLOR,
          marginBottom: 2,
          fontFamily: "sans-serif",
        }}
      >
        {name}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: TEXT_COLOR,
            fontFamily: "sans-serif",
          }}
        >
          {latest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {currencyStr}
        </span>
        <span style={{ fontSize: 14, color, fontFamily: "sans-serif" }}>
          {sign}
          {delta.toFixed(2)}
          {currencyStr}&nbsp;({sign}
          {deltaPct.toFixed(2)}%)&nbsp;
          <span style={{ fontSize: 12, color: SUBTEXT_COLOR }}>{deltaLabel}</span>
        </span>
      </div>
    </div>
  );
}
