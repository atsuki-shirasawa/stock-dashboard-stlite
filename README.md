<!-- @format -->

# Stock Dashboard

A client-side stock dashboard built with React + Vite, running entirely in the browser — no server required.

**Live demo:** <https://atsuki-shirasawa.github.io/stock-dashboard-stlite/>

## Features

- Candlestick and area charts with optional volume subplot
- Periods: 1D / 1W / 1M / 6M / 1Y / 5Y / 10Y
- Timestamps displayed in the browser's local timezone
- Shareable URLs — symbol, period, chart type, and date are all synced to query params
- Works for US and Japanese stocks (e.g. `AAPL`, `7203.T`)
- Resilient data layer: parallel endpoint racing, per-request timeouts, and a
  `localStorage` cache that keeps serving the last good data when the API is down

## URL parameters

| Parameter | Values                                | Example          |
| --------- | ------------------------------------- | ---------------- |
| `symbol`  | Ticker symbol                         | `AAPL`, `7203.T` |
| `period`  | `1d` `1w` `1mo` `6mo` `1y` `5y` `10y` | `1y`             |
| `chart`   | `candlestick` `area`                  | `area`           |
| `vol`     | `1` to show volume                    | `1`              |
| `date`    | `YYYY-MM-DD` for historical view      | `2024-01-15`     |

## Tech stack

| Layer        | Library                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| UI framework | [React 19](https://react.dev/) + TypeScript                                                                                 |
| Build tool   | [Vite 8](https://vitejs.dev/)                                                                                               |
| Charts       | [Plotly.js](https://plotly.com/javascript/) (finance-dist) via [react-plotly.js](https://github.com/plotly/react-plotly.js) |
| Icons        | [Lucide React](https://lucide.dev/)                                                                                         |
| Linter       | [Biome](https://biomejs.dev/)                                                                                               |
| Data         | [Yahoo Finance chart API](https://query1.finance.yahoo.com/) via a CORS proxy (see below)                                   |
| Deployment   | GitHub Actions → GitHub Pages                                                                                               |

## Data fetching and caching

The Yahoo Finance chart API sends no CORS headers, so a browser cannot call it
directly and every request has to go through a proxy.

**Layers, from cheapest to most expensive:**

1. **`localStorage` cache** — per browser. TTL varies by period (1 minute for
   `1D`, 5 minutes for daily-interval ranges, up to 6 hours for `10Y`), so
   long-range charts are not refetched needlessly.
2. **Shared edge cache** — the optional Cloudflare Worker in `worker/`. Its cache
   is shared by *every* viewer, so the first person to open a symbol warms it for
   everyone else. Browser storage is per-origin and per-browser and can never do
   this.
3. **Live fetch** — all candidate endpoints (2 Yahoo hosts × the configured
   proxies) race in parallel with a 6-second per-request timeout, so one hanging
   proxy no longer stalls the load.

If every endpoint fails, an expired cache entry is served instead of an error
(up to 7 days old) and the header shows a `Cached · <time>` badge.

### Self-hosted proxy (recommended)

The public CORS proxies are rate-limited and unreliable — `corsproxy.io` now
requires an API key for anonymous traffic. Deploying the bundled Worker removes
that dependency and gives you the shared cache:

```bash
cd worker
npm install
npx wrangler deploy      # prints https://yf-proxy.<subdomain>.workers.dev
```

Then point the app at it:

```bash
echo "VITE_YF_PROXY=https://yf-proxy.<subdomain>.workers.dev" > .env.local
```

Without `VITE_YF_PROXY` the app falls back to the public proxies. See below for
wiring it up in CI.

**Two independent allowlists guard the Worker:**

- `ALLOWED_HOSTS` (in `worker/src/index.ts`) limits what it will fetch to
  `query1/query2.finance.yahoo.com`, so it can never be used as an open relay.
- `ALLOWED_ORIGINS` (in `worker/wrangler.toml`) limits which browser origins may
  call it. `VITE_YF_PROXY` is inlined into the public bundle, so without this
  anyone who finds the URL can spend your quota. Set it to your site's origin:

  ```toml
  [vars]
  ALLOWED_ORIGINS = "https://<user>.github.io,http://localhost:5173"
  ```

  Leave it empty to accept any origin. Requests from a non-listed origin — and
  requests with no `Origin` header at all, i.e. non-browser callers — get 403.

## Local development

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run build    # type-check and build to dist/
npm run preview  # preview the production build locally
npm run lint     # lint with Biome
npm run format   # auto-format with Biome
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which lints, builds, and deploys `dist/` to GitHub Pages automatically.

> **GitHub Pages setup**: go to Settings → Pages → Source and select **GitHub Actions**.

### Wiring the proxy into CI

Under **Settings → Secrets and variables → Actions**:

| Name                    | Kind     | Purpose                                                          |
| ----------------------- | -------- | ---------------------------------------------------------------- |
| `VITE_YF_PROXY`         | Variable | Worker URL, inlined into the bundle by `deploy.yml`              |
| `DEPLOY_WORKER`         | Variable | Set to `true` to enable `.github/workflows/deploy-worker.yml`    |
| `CLOUDFLARE_API_TOKEN`  | Secret   | Workers Scripts: Edit permission                                  |
| `CLOUDFLARE_ACCOUNT_ID` | Secret   | Cloudflare account ID                                             |

`VITE_YF_PROXY` is a **variable, not a secret** — Vite inlines it into the public
bundle, so it is visible to anyone who opens the site. That is fine (the Worker
allowlists Yahoo hosts), but it does mean the endpoint is publicly callable; add
[Cloudflare rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
if that matters to you.

`deploy-worker.yml` only runs when `worker/**` changes, and stays skipped until
`DEPLOY_WORKER` is set — until then you can deploy manually with
`cd worker && npx wrangler deploy`.
