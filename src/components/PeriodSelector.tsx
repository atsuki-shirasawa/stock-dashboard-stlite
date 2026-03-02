import { FONT_FAMILY, PERIODS, SUBTEXT_COLOR, TEXT_COLOR, UP_COLOR } from "../constants";

const PERIOD_LABELS = Object.keys(PERIODS) as string[];

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {PERIOD_LABELS.map((label) => {
        const active = label === value;
        return (
          <button
            key={label}
            onClick={() => onChange(label)}
            style={{
              background: active ? `rgba(16,185,129,0.10)` : "transparent",
              border: active
                ? `1px solid ${UP_COLOR}`
                : "1px solid rgba(100,116,139,0.20)",
              borderRadius: 6,
              color: active ? TEXT_COLOR : SUBTEXT_COLOR,
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              padding: "5px 10px",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
