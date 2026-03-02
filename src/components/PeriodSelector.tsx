import {
	DOWN_COLOR,
	DOWN_FILL,
	PERIODS,
	SUBTEXT_COLOR,
	TEXT_COLOR,
	UP_COLOR,
	UP_FILL,
} from "../constants";

const PERIOD_LABELS = Object.keys(PERIODS) as string[];

interface PeriodSelectorProps {
	value: string;
	onChange: (period: string) => void;
	isUp?: boolean;
}

export default function PeriodSelector({
	value,
	onChange,
	isUp = true,
}: PeriodSelectorProps) {
	const accentColor = isUp ? UP_COLOR : DOWN_COLOR;
	const accentFill = isUp ? UP_FILL : DOWN_FILL;

	return (
		<div style={{ display: "flex", gap: 4 }}>
			{PERIOD_LABELS.map((label) => {
				const active = label === value;
				return (
					<button
						key={label}
						type="button"
						onClick={() => onChange(label)}
						style={{
							background: active ? accentFill : "transparent",
							border: active
								? `1px solid ${accentColor}`
								: "1px solid rgba(100,116,139,0.20)",
							borderRadius: 6,
							color: active ? TEXT_COLOR : SUBTEXT_COLOR,
							cursor: "pointer",
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
