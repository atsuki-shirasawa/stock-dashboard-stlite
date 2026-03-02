<!-- @format -->

# Stock Dashboard

A client-side stock dashboard built with React + Vite, running entirely in the browser — no server required.

**Live demo:** <https://atsuki-shirasawa.github.io/stock-dashboad-streamlit/>

## Features

- Candlestick and area charts with optional volume subplot
- Periods: 1D / 1W / 1M / 6M / 1Y / 5Y / 10Y
- Timestamps displayed in the browser's local timezone
- Shareable URLs — symbol, period, chart type, and date are all synced to query params
- Works for US and Japanese stocks (e.g. `AAPL`, `7203.T`)
- 5-minute client-side cache via `sessionStorage`

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
| UI framework | [React 18](https://react.dev/) + TypeScript                                                                                 |
| Build tool   | [Vite 5](https://vitejs.dev/)                                                                                               |
| Charts       | [Plotly.js](https://plotly.com/javascript/) (finance-dist) via [react-plotly.js](https://github.com/plotly/react-plotly.js) |
| Data         | [Yahoo Finance chart API](https://query1.finance.yahoo.com/) via [corsproxy.io](https://corsproxy.io/)                      |
| Deployment   | GitHub Actions → GitHub Pages                                                                                               |

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
npm run preview # preview the production build locally
```

## Deployment

Pushing to `main` triggers GitHub Actions, which builds the app and deploys `dist/` to GitHub Pages automatically.

> **GitHub Pages setup**: go to Settings → Pages → Source and select **GitHub Actions**.
