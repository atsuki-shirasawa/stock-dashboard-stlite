# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (Vite HMR)
npm run build    # tsc type-check + Vite production build → dist/
npm run preview  # serve dist/ locally
npm run lint     # Biome check (src/ only)
npm run format   # Biome auto-format (src/ only)
```

No test suite exists in this project.

## Architecture

**Embed-first design**: The dashboard is intended to be embedded (e.g. Notion). All configuration is done via URL query params — there is no interactive UI for changing symbol or chart type. Only the period selector is interactive.

### Data flow

```
URL params (readParams)
  → useState lazy-init in App
  → fetchChart (yahooFinance.ts)
      → sessionStorage cache (5 min TTL)
      → corsproxy.io → Yahoo Finance v8/chart API
  → ChartData { rows: OHLCVRow[], meta: StockMeta }
  → PriceHeader / StockChart / SubMetrics
```

### Key files

- `src/constants.ts` — all color tokens, period config, URL param key mappings, cache TTL
- `src/types/stock.ts` — shared types: `OHLCVRow`, `StockMeta`, `ChartData`, `ChartType`
- `src/api/yahooFinance.ts` — fetch + parse + sessionStorage cache; `fetchChart(symbol, periodLabel, endDate?, signal?)`
- `src/App.tsx` — URL state management (`readParams` / `writeParams`), abort controller, single `load` callback

### URL params

| Param    | Values                                  | Default  |
| -------- | --------------------------------------- | -------- |
| `symbol` | ticker (uppercase)                      | `AAPL`   |
| `period` | `1d` `1w` `1mo` `6mo` `1y` `5y` `10y`  | `1y`     |
| `chart`  | `candlestick` `area`                    | `area`   |
| `vol`    | `1` to show volume subplot              | off      |
| `date`   | `YYYY-MM-DD` historical end date        | today    |

### Plotly integration

- Uses `plotly.js-finance-dist` (not basic-dist) bound via `react-plotly.js/factory`
- `StockChart.tsx` is a pure render function (no hooks) — layout and traces are rebuilt per render, which is intentional since Plotly's internal `shouldComponentUpdate` prevents redundant redraws
- **1W period**: categorical x-axis to avoid overnight gaps
- **1M/6M/1Y**: date x-axis with `rangebreaks` computed by enumerating missing calendar days
- **5Y/10Y**: no rangebreaks (weekly/monthly data; gaps acceptable)
- `FONT_FAMILY` must be set explicitly in Plotly layout — it does not inherit from CSS

### Styling

All styles are inline React style objects. Color tokens are in `constants.ts`; do not hardcode color strings in components. `fontFamily` is **not** needed on individual HTML elements (set globally in `index.html` body), but **is** required inside Plotly layout config.

### Biome config notes

- Indentation: **tabs**
- Quotes: **double**
- `noNonNullAssertion` is disabled — `!` assertions are used in components guarded by `rows.length === 0` early returns
