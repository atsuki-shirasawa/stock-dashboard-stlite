import { type FormEvent, useRef } from "react";
import { BG, SUBTEXT_COLOR, TEXT_COLOR } from "../constants";

interface SearchBarProps {
  value: string;
  onSubmit: (symbol: string) => void;
}

export default function SearchBar({ value, onSubmit }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const v = inputRef.current?.value.trim().toUpperCase() ?? "";
    if (v) onSubmit(v);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
      <input
        ref={inputRef}
        defaultValue={value}
        placeholder="Symbol (e.g. AAPL, 7203.T)"
        style={{
          background: BG,
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 6,
          color: TEXT_COLOR,
          fontFamily: "sans-serif",
          fontSize: 14,
          padding: "6px 12px",
          outline: "none",
          width: 220,
        }}
      />
      <button
        type="submit"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 6,
          color: SUBTEXT_COLOR,
          cursor: "pointer",
          fontFamily: "sans-serif",
          fontSize: 13,
          padding: "6px 14px",
        }}
      >
        Go
      </button>
    </form>
  );
}
