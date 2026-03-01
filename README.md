<!-- @format -->

# Stock Dashboard

A client-side stock dashboard built with [stlite](https://github.com/whitphx/stlite) (Streamlit on WebAssembly), running entirely in the browser — no server required.

**Live demo:** https://atsuki-shirasawa.github.io/stock-dashboard-stlite/

## Features

- Candlestick and area charts with volume subplot
- Periods: 1D / 1W / 1M / 6M / 1Y / 5Y / 10Y
- Historical date picker — browse any past date via URL query params
- Timestamps in Japan Standard Time (JST)
- Shareable URLs (symbol, period, chart type, and date are all synced to query params)
- Works for US and Japanese stocks (e.g. `AAPL`, `7203.T`)

## Tech stack

| Layer        | Library                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| UI framework | [Streamlit](https://streamlit.io/) via [stlite](https://github.com/whitphx/stlite)                     |
| Charts       | [Plotly](https://plotly.com/python/)                                                                   |
| Data         | [Yahoo Finance chart API](https://query1.finance.yahoo.com/) via [corsproxy.io](https://corsproxy.io/) |
| Runtime      | Pyodide (Python on WebAssembly)                                                                        |

## Why not yfinance?

`yfinance >= 0.2.50` depends on `curl-cffi`, a native C extension that cannot be compiled to WebAssembly. This app replaces it with direct calls to Yahoo Finance's public chart API (`/v8/finance/chart`), routed through a CORS proxy so the browser can reach it.

## Local development

```bash
uv sync
uv run streamlit run main.py
```

## Deployment

The app is a static site — `index.html` loads stlite and `main.py` is fetched as a plain text file. Any static host works.

GitHub Pages is configured to serve from the `main` branch root.
