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

export default function SubMetrics({ rows, meta }: SubMetricsProps) {
  if (rows.length === 0) return null;

  const periodHigh = Math.max(...rows.map((r) => r.high));
  const periodLow = Math.min(...rows.map((r) => r.low));
  const latestVolume = rows[rows.length - 1]!.volume;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const items: MetricItem[] = [
    { label: "Period High", value: fmt(periodHigh) },
    { label: "Period Low", value: fmt(periodLow) },
    { label: "Latest Volume", value: latestVolume.toLocaleString() },
    {
      label: "52W High",
      value: meta.fiftyTwoWeekHigh != null ? fmt(meta.fiftyTwoWeekHigh) : "—",
    },
    {
      label: "52W Low",
      value: meta.fiftyTwoWeekLow != null ? fmt(meta.fiftyTwoWeekLow) : "—",
    },
    { label: "Currency", value: meta.currency ?? "—" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "20px 32px",
        padding: "14px 4px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
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
              fontFamily: "sans-serif",
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
              fontFamily: "sans-serif",
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
