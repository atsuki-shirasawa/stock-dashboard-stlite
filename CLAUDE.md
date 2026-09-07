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

```text
URL params (readParams)
  → useState lazy-init in App
  → fetchChart (yahooFinance.ts)
      → localStorage cache (per-period TTL, stale-while-error)
      → optional self-hosted Worker proxy (VITE_YF_PROXY)
      → public CORS proxies (raced in parallel) → Yahoo Finance v8/chart API
  → ChartData { rows: OHLCVRow[], meta: StockMeta }
  → PriceHeader / StockChart / SubMetrics
```

### Key files

- `src/constants.ts` — all color tokens, period config, URL param key mappings, cache TTLs (`PERIOD_CACHE_TTL_MS`, `STALE_MAX_AGE_MS`), `FETCH_TIMEOUT_MS`
- `src/types/stock.ts` — shared types: `OHLCVRow`, `StockMeta`, `ChartData`, `ChartType`
- `src/api/yahooFinance.ts` — fetch + parse + cache; `fetchChart(symbol, periodLabel, endDate?, signal?)`
- `src/App.tsx` — URL state management (`readParams` / `writeParams`), abort controller, single `load` callback
- `worker/` — optional Cloudflare Worker CORS proxy with a viewer-shared edge cache. Separate npm project; `cd worker && npm install && npx wrangler deploy`

### Data layer invariants (`yahooFinance.ts`)

- **Cache is `localStorage`, not `sessionStorage`** — the dashboard is embedded in iframes, which start a fresh session on every reload. Falls back to `sessionStorage`, then to no cache at all (private mode / blocked storage).
- **Expired entries are never deleted on read.** They are the fallback served when every endpoint fails (`stale: true` on `ChartData`, up to `STALE_MAX_AGE_MS`). Only `AbortError` propagates untouched.
- **All candidate endpoints race** (`Promise.any`) with a per-attempt timeout; response parsing happens *inside* each attempt so a proxy returning HTTP 200 with an HTML error page loses the race instead of poisoning the result.
- **`cacheBust` granularity equals the period TTL** (`Math.floor(Date.now() / ttlMs)`). It is embedded in the Yahoo URL, so it also rotates the *upstream* proxy cache key — matching the two means a proxy cache entry stays warm for exactly as long as the client considers the data fresh.
- **The crumb never blocks the happy path.** `fetchCrumb` is started but not awaited; the chart is attempted without one first, and the crumb is only awaited on failure.
- **`worker/src/index.ts` allowlists Yahoo hosts.** Do not relax `ALLOWED_HOSTS` — without it the Worker is an open relay.

### Environment variables

- `VITE_YF_PROXY` — optional self-hosted proxy base URL. Tried alone before the public proxies. Typed in `src/vite-env.d.ts`; example in `.env.example`.

### URL params

- `symbol` — ticker symbol, uppercase (default: `AAPL`)
- `period` — `1d` `1w` `1mo` `6mo` `1y` `5y` `10y` (default: `1y`)
- `chart` — `candlestick` or `area` (default: `area`)
- `vol` — `1` to enable volume subplot
- `date` — `YYYY-MM-DD` historical end date

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
