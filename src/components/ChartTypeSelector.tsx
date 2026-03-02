import { CHART_TYPES, SUBTEXT_COLOR, TEXT_COLOR, UP_COLOR } from "../constants";
import type { ChartType } from "../types/stock";

const ICONS: Record<ChartType, string> = {
  Candlestick: "🕯️",
  Area: "📈",
};

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export default function ChartTypeSelector({
  value,
  onChange,
}: ChartTypeSelectorProps) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {CHART_TYPES.map((type) => {
        const active = type === value;
        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            style={{
              background: active ? "rgba(255,255,255,0.10)" : "transparent",
              border: active
                ? `1px solid ${UP_COLOR}`
                : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6,
              color: active ? TEXT_COLOR : SUBTEXT_COLOR,
              cursor: "pointer",
              fontFamily: "sans-serif",
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              padding: "5px 10px",
              transition: "all 0.15s",
            }}
          >
            {ICONS[type]} {type}
          </button>
        );
      })}
    </div>
  );
}
