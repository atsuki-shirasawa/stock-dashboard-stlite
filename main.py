"""Stock Dashboard - Streamlit + Plotly."""

import urllib.parse
from datetime import UTC, date, datetime, timedelta

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
from plotly.subplots import make_subplots

# ── Color theme ───────────────────────────────────────────────────────
BG = "#0d1117"
PANEL_BG = "#161b22"
UP_COLOR = "#00d4a0"
DOWN_COLOR = "#f43f5e"
UP_FILL = "rgba(0,212,160,0.20)"
DOWN_FILL = "rgba(244,63,94,0.20)"
VOL_UP = "rgba(0,212,160,0.50)"
VOL_DOWN = "rgba(244,63,94,0.50)"
GRID_COLOR = "rgba(255,255,255,0.05)"
SPIKE_COLOR = "rgba(255,255,255,0.25)"
TEXT_COLOR = "#c9d1d9"
SUBTEXT_COLOR = "#8b949e"

# ── Period config ─────────────────────────────────────────────────────
PERIODS: dict[str, dict[str, str]] = {
    "1D": {"period": "1d", "interval": "5m"},
    "1W": {"period": "5d", "interval": "30m"},
    "1M": {"period": "1mo", "interval": "1d"},
    "6M": {"period": "6mo", "interval": "1d"},
    "1Y": {"period": "1y", "interval": "1d"},
    "5Y": {"period": "5y", "interval": "1wk"},
    "10Y": {"period": "10y", "interval": "1mo"},
}
_PERIOD_DELTA: dict[str, timedelta] = {
    "1D": timedelta(days=1),
    "1W": timedelta(weeks=1),
    "1M": timedelta(days=30),
    "6M": timedelta(days=182),
    "1Y": timedelta(days=365),
    "5Y": timedelta(days=365 * 5),
    "10Y": timedelta(days=365 * 10),
}
_DELTA_LABELS: dict[str, str] = {
    "1D": "vs prev day",
    "1W": "vs 1W ago",
    "1M": "vs 1M ago",
    "6M": "vs 6M ago",
    "1Y": "vs 1Y ago",
    "5Y": "vs 5Y ago",
    "10Y": "vs 10Y ago",
}

# Query param keys (label → key / key → label)
PERIOD_TO_KEY: dict[str, str] = {
    "1D": "1d",
    "1W": "1w",
    "1M": "1mo",
    "6M": "6mo",
    "1Y": "1y",
    "5Y": "5y",
    "10Y": "10y",
}
PERIOD_FROM_KEY: dict[str, str] = {v: k for k, v in PERIOD_TO_KEY.items()}

CHART_TYPES = ["Candlestick", "Area"]
CHART_ICONS: dict[str, str] = {"Candlestick": "🕯️", "Area": "📈"}
CHART_TO_KEY: dict[str, str] = {"Candlestick": "candlestick", "Area": "area"}
CHART_FROM_KEY: dict[str, str] = {v: k for k, v in CHART_TO_KEY.items()}

DEFAULT_SYMBOL = "AAPL"
DEFAULT_PERIOD = "1Y"
DEFAULT_CHART = "Area"

# ── Yahoo Finance API ─────────────────────────────────────────────────
_CORS_PROXY = "https://corsproxy.io/?url="
_YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
_YF_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

# ── Chart x-axis common config ────────────────────────────────────────
_XAXIS_COMMON: dict = dict(
    showgrid=False,
    zeroline=False,
    showspikes=True,
    spikecolor=SPIKE_COLOR,
    spikethickness=1,
    spikedash="dot",
    spikesnap="cursor",
    tickfont=dict(color=SUBTEXT_COLOR, size=11),
)


def _yf_url(
    symbol: str,
    period_label: str,
    end_date: date | None = None,
) -> str:
    """Return the Yahoo Finance chart API URL routed through a CORS proxy.

    Uses range-based query when end_date is None (always up to today),
    and period1/period2 timestamps when a specific end date is given.
    """
    cfg = PERIODS[period_label]
    interval = cfg["interval"]
    if end_date is None:
        yf = f"{_YF_BASE}/{symbol}?range={cfg['period']}&interval={interval}"
    else:
        end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=UTC)
        start_dt = end_dt - _PERIOD_DELTA[period_label]
        yf = (
            f"{_YF_BASE}/{symbol}"
            f"?period1={int(start_dt.timestamp())}"
            f"&period2={int(end_dt.timestamp())}"
            f"&interval={interval}"
        )
    return _CORS_PROXY + urllib.parse.quote(yf, safe="")


def _parse_meta(meta: dict) -> dict:
    """Extract basic stock info from a chart API meta object."""
    return {
        "shortName": meta.get("shortName") or meta.get("longName"),
        "previousClose": meta.get("chartPreviousClose")
        or meta.get("previousClose"),
        "currency": meta.get("currency"),
        "fiftyTwoWeekHigh": meta.get("fiftyTwoWeekHigh"),
        "fiftyTwoWeekLow": meta.get("fiftyTwoWeekLow"),
    }


def fetch_chart(
    symbol: str,
    period_label: str,
    end_date: date | None = None,
) -> tuple[pd.DataFrame, dict]:
    """Fetch OHLCV data and stock meta info in a single API call.

    Args:
        symbol: Ticker symbol (e.g. AAPL, 7203.T)
        period_label: Period key from PERIODS (e.g. "1Y", "6M")
        end_date: End date for the data range; None means up to today.

    Returns:
        Tuple of (OHLCV DataFrame, meta info dict).
    """
    resp = requests.get(
        _yf_url(symbol, period_label, end_date),
        headers=_YF_HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    chart_result = resp.json().get("chart", {}).get("result") or []
    if not chart_result:
        return pd.DataFrame(), {}

    result = chart_result[0]
    timestamps = result.get("timestamp", [])
    quotes = result.get("indicators", {}).get("quote", [{}])[0]

    df = pd.DataFrame(
        {
            "Open": quotes.get("open", []),
            "High": quotes.get("high", []),
            "Low": quotes.get("low", []),
            "Close": quotes.get("close", []),
            "Volume": quotes.get("volume", []),
        },
        index=pd.to_datetime(timestamps, unit="s", utc=True).tz_convert("Asia/Tokyo"),
    )
    return df.dropna(subset=["Close"]), _parse_meta(result.get("meta", {}))


def _compact_metrics_html(items: list[tuple[str, str]]) -> str:
    """Convert (label, value) pairs into compact inline HTML.

    Args:
        items: List of (label, value) tuples.

    Returns:
        HTML string to pass to st.markdown.
    """
    cells = "".join(
        f"""
        <div style="display:flex;flex-direction:column;gap:2px;min-width:80px">
          <span style="font-size:11px;color:{SUBTEXT_COLOR};white-space:nowrap">{label}</span>
          <span style="font-size:13px;color:{TEXT_COLOR};font-weight:500;white-space:nowrap">{value}</span>
        </div>"""
        for label, value in items
    )
    return (
        f'<div style="display:flex;flex-wrap:wrap;gap:20px 32px;'
        f'padding:14px 4px;border-top:1px solid rgba(255,255,255,0.07)">'
        f"{cells}</div>"
    )


def _add_candlestick(fig: go.Figure, df: pd.DataFrame, symbol: str) -> None:
    """Add a candlestick trace to the figure.

    Args:
        fig: Target Figure.
        df: OHLCV data.
        symbol: Ticker symbol.
    """
    fig.add_trace(
        go.Candlestick(
            x=df.index,
            open=df["Open"],
            high=df["High"],
            low=df["Low"],
            close=df["Close"],
            increasing=dict(line=dict(color=UP_COLOR, width=1), fillcolor=UP_COLOR),
            decreasing=dict(line=dict(color=DOWN_COLOR, width=1), fillcolor=DOWN_COLOR),
            name=symbol,
            hoverlabel=dict(bgcolor=PANEL_BG),
        ),
        row=1,
        col=1,
    )


def _add_area(fig: go.Figure, df: pd.DataFrame, symbol: str) -> None:
    """Add an area chart trace to the figure.

    Args:
        fig: Target Figure.
        df: OHLCV data.
        symbol: Ticker symbol.
    """
    is_up = df["Close"].iloc[-1] >= df["Close"].iloc[0]
    line_color = UP_COLOR if is_up else DOWN_COLOR
    fill_color = UP_FILL if is_up else DOWN_FILL

    # Fill down to just below the period low for a natural gradient effect
    base = float(df["Close"].min()) * 0.998
    fig.add_trace(
        go.Scatter(
            x=df.index,
            y=[base] * len(df),
            mode="lines",
            line=dict(width=0, color="rgba(0,0,0,0)"),
            showlegend=False,
            hoverinfo="skip",
        ),
        row=1,
        col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=df.index,
            y=df["Close"],
            mode="lines",
            name=symbol,
            line=dict(color=line_color, width=2),
            fill="tonexty",
            fillcolor=fill_color,
            hovertemplate=(
                "<b>%{x|%Y-%m-%d %H:%M}</b><br>"
                f"Close: %{{y:,.2f}}<extra>{symbol}</extra>"
            ),
        ),
        row=1,
        col=1,
    )


def _get_rangebreaks(df: pd.DataFrame) -> list[dict]:
    """Return rangebreaks for non-trading days (weekends, holidays).

    Identifies missing dates by comparing actual trading days against the full
    calendar range, so it works correctly for any market or region.

    Args:
        df: OHLCV data with a DatetimeIndex.

    Returns:
        List of dicts suitable for Plotly rangebreaks.
    """
    trading_days = pd.DatetimeIndex(df.index.date).normalize()
    trading_set = set(trading_days)
    all_days = pd.date_range(trading_days.min(), trading_days.max(), freq="D")
    missing = [d for d in all_days if d not in trading_set]
    if not missing:
        return []
    return [dict(values=[d.strftime("%Y-%m-%d") for d in missing])]


def build_chart(
    df: pd.DataFrame,
    symbol: str,
    period_label: str,
    chart_type: str,
) -> go.Figure:
    """Build a price chart (candlestick or area) with a volume subplot.

    Args:
        df: OHLCV DataFrame.
        symbol: Ticker symbol.
        period_label: Display label for the selected period.
        chart_type: "Candlestick" or "Area".

    Returns:
        Plotly Figure object.
    """
    fig = make_subplots(
        rows=2,
        cols=1,
        shared_xaxes=True,
        vertical_spacing=0.04,
        row_heights=[0.72, 0.28],
    )

    # For 1W, use categorical x-axis to avoid overnight gaps
    use_category = period_label == "1W"
    if use_category:
        df = df.copy()
        df.index = df.index.strftime("%Y-%m-%d %H:%M")

    if chart_type == "Area":
        _add_area(fig, df, symbol)
    else:
        _add_candlestick(fig, df, symbol)

    bar_colors = [
        VOL_UP if c >= o else VOL_DOWN
        for c, o in zip(df["Close"], df["Open"], strict=True)
    ]
    fig.add_trace(
        go.Bar(
            x=df.index,
            y=df["Volume"],
            name="Volume",
            marker=dict(color=bar_colors, line=dict(width=0)),
            showlegend=False,
            hovertemplate="Volume: %{y:,.0f}<extra></extra>",
        ),
        row=2,
        col=1,
    )

    fig.update_layout(
        title=dict(
            text=f"<b>{symbol}</b>　<span style='font-size:14px;color:{SUBTEXT_COLOR}'>{period_label}</span>",
            font=dict(size=22, color=TEXT_COLOR, family="sans-serif"),
            x=0.02,
            xanchor="left",
        ),
        xaxis_rangeslider_visible=False,
        height=400,
        margin=dict(t=64, b=24, l=12, r=12),
        plot_bgcolor=BG,
        paper_bgcolor=BG,
        font=dict(color=TEXT_COLOR, family="sans-serif", size=12),
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor=PANEL_BG,
            bordercolor="rgba(255,255,255,0.12)",
            font=dict(color=TEXT_COLOR, size=12),
        ),
        legend=dict(bgcolor="rgba(0,0,0,0)", bordercolor="rgba(0,0,0,0)"),
    )

    if use_category:
        fig.update_xaxes(**_XAXIS_COMMON, type="category", nticks=6)
    else:
        fig.update_xaxes(**_XAXIS_COMMON, rangebreaks=_get_rangebreaks(df))

    fig.update_yaxes(
        gridcolor=GRID_COLOR,
        zeroline=False,
        showspikes=False,
        tickfont=dict(color=SUBTEXT_COLOR, size=11),
        side="right",
        title_text="",
    )

    return fig


def sync_query_params(
    symbol: str,
    period: str,
    chart: str,
    end_date: date | None = None,
) -> None:
    """Sync URL query parameters to the current selection.

    Args:
        symbol: Ticker symbol.
        period: Period label.
        chart: Chart type.
        end_date: End date; omitted from URL when None (= today).
    """
    st.query_params["symbol"] = symbol
    st.query_params["period"] = PERIOD_TO_KEY.get(period, period)
    st.query_params["chart"] = CHART_TO_KEY.get(chart, chart)
    if end_date is not None and end_date < date.today():
        st.query_params["date"] = end_date.isoformat()
    else:
        st.query_params.pop("date", None)


def main() -> None:
    """Entry point for the stock dashboard."""
    st.set_page_config(
        page_title="Stock Dashboard",
        page_icon="📈",
        layout="wide",
    )

    # ── Read initial values from query params ─────────────────────────
    params = st.query_params
    init_symbol: str = str(params.get("symbol", DEFAULT_SYMBOL)).upper()
    _period_raw: str = str(params.get("period", PERIOD_TO_KEY[DEFAULT_PERIOD]))
    init_period: str = PERIOD_FROM_KEY.get(_period_raw, DEFAULT_PERIOD)
    if init_period not in PERIODS:
        init_period = DEFAULT_PERIOD
    _chart_raw: str = str(params.get("chart", CHART_TO_KEY[DEFAULT_CHART]))
    init_chart: str = CHART_FROM_KEY.get(_chart_raw, DEFAULT_CHART)
    if init_chart not in CHART_TYPES:
        init_chart = DEFAULT_CHART
    _date_raw = params.get("date")
    try:
        init_date: date = (
            date.fromisoformat(_date_raw) if _date_raw else date.today()
        )
    except ValueError:
        init_date = date.today()

    # ── Controls ──────────────────────────────────────────────────────
    ctl_left, ctl_mid, ctl_right = st.columns([2, 1, 1])

    with ctl_left:
        input_symbol = (
            st.text_input(
                "Ticker",
                value=init_symbol,
                label_visibility="collapsed",
                placeholder="Ticker (e.g. AAPL / 7203.T)",
            )
            .strip()
            .upper()
        )

    with ctl_mid:
        input_date: date = st.date_input(  # type: ignore[assignment]
            "Date",
            value=init_date,
            max_value=date.today(),
            label_visibility="collapsed",
        )

    with ctl_right:
        input_chart = st.segmented_control(
            "Chart type",
            options=CHART_TYPES,
            default=init_chart,
            label_visibility="collapsed",
            format_func=lambda x: CHART_ICONS.get(x, x),
        )

    input_period = st.segmented_control(
        "Period",
        options=list(PERIODS.keys()),
        default=init_period,
        label_visibility="collapsed",
    )

    # Sync URL when inputs change
    resolved_period: str = input_period or init_period  # type: ignore[assignment]
    resolved_chart: str = input_chart or init_chart  # type: ignore[assignment]
    resolved_date: date = input_date or date.today()
    end_date: date | None = (
        resolved_date if resolved_date < date.today() else None
    )

    if (
        input_symbol != init_symbol
        or resolved_period != init_period
        or resolved_chart != init_chart
        or resolved_date != init_date
    ):
        sync_query_params(input_symbol, resolved_period, resolved_chart, end_date)

    symbol = input_symbol or DEFAULT_SYMBOL
    period_label = resolved_period
    chart_type = resolved_chart

    # ── Fetch OHLCV and meta in a single API call ─────────────────────
    with st.spinner(f"Fetching data for {symbol}..."):
        df, info = fetch_chart(symbol, period_label, end_date)

    if df.empty:
        st.error(
            f"No data found for **{symbol}**. Please check the ticker symbol.",
        )
        return

    # ── Price and change ──────────────────────────────────────────────
    latest = df["Close"].iloc[-1]
    delta_label = _DELTA_LABELS.get(period_label, "vs prev day")

    if period_label == "1D":
        # Use previousClose from meta; intraday df[0] is near the open, not prev close
        prev = float(info.get("previousClose") or df["Close"].iloc[0])
    else:
        prev = float(df["Close"].iloc[0])

    delta = latest - prev
    delta_pct = delta / prev * 100 if prev else 0.0

    currency = info.get("currency", "")
    currency_str = f" {currency}" if currency else ""
    st.metric(
        label=info.get("shortName", symbol),
        value=f"{latest:,.2f}{currency_str}",
        delta=f"{delta:+.2f}{currency_str}  ({delta_pct:+.2f}%)  {delta_label}",
    )

    # ── Chart ─────────────────────────────────────────────────────────
    st.plotly_chart(
        build_chart(df, symbol, period_label, chart_type),
        use_container_width=True,
    )

    # ── Sub-metrics ───────────────────────────────────────────────────
    week52_high = info.get("fiftyTwoWeekHigh")
    week52_low = info.get("fiftyTwoWeekLow")
    sub_items: list[tuple[str, str]] = [
        ("Period High", f"{df['High'].max():,.2f}"),
        ("Period Low", f"{df['Low'].min():,.2f}"),
        ("Latest Volume", f"{df['Volume'].iloc[-1]:,.0f}"),
        ("52W High", f"{week52_high:,.2f}" if week52_high else "—"),
        ("52W Low", f"{week52_low:,.2f}" if week52_low else "—"),
        ("Currency", currency or "—"),
    ]
    st.markdown(_compact_metrics_html(sub_items), unsafe_allow_html=True)


if __name__ == "__main__":
    main()
