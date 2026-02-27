"""株価ダッシュボード - yfinance + Streamlit + Plotly."""

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf
from plotly.subplots import make_subplots

# ── カラーテーマ ──────────────────────────────────────────────────────
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

PERIODS: dict[str, dict[str, str]] = {
    "1日": {"period": "1d", "interval": "5m"},
    "1週": {"period": "5d", "interval": "30m"},
    "1ヶ月": {"period": "1mo", "interval": "1d"},
    "6ヶ月": {"period": "6mo", "interval": "1d"},
    "1年": {"period": "1y", "interval": "1d"},
    "5年": {"period": "5y", "interval": "1wk"},
    "10年": {"period": "10y", "interval": "1mo"},
}

# クエリパラメータ用の英語キー（ラベル → キー / キー → ラベル）
PERIOD_TO_KEY: dict[str, str] = {
    "1日": "1d",
    "1週": "1w",
    "1ヶ月": "1mo",
    "6ヶ月": "6mo",
    "1年": "1y",
    "5年": "5y",
    "10年": "10y",
}
PERIOD_FROM_KEY: dict[str, str] = {v: k for k, v in PERIOD_TO_KEY.items()}

CHART_TYPES = ["ローソク足", "エリア"]
CHART_ICONS: dict[str, str] = {
    "ローソク足": "🕯️",
    "エリア": "📈",
}
CHART_TO_KEY: dict[str, str] = {"ローソク足": "candlestick", "エリア": "area"}
CHART_FROM_KEY: dict[str, str] = {v: k for k, v in CHART_TO_KEY.items()}

DEFAULT_SYMBOL = "AAPL"
DEFAULT_PERIOD = "1年"
DEFAULT_CHART = "エリア"


def fetch_stock_data(
    symbol: str,
    period: str,
    interval: str,
) -> pd.DataFrame:
    """指定した銘柄・期間・間隔で株価データを取得する.

    Args:
        symbol: ティッカーシンボル (例: AAPL, 7203.T)
        period: 取得期間 (例: 1d, 1mo, 1y)
        interval: データ間隔 (例: 5m, 1d, 1wk)

    Returns:
        OHLCV データを含むDataFrame
    """
    ticker = yf.Ticker(symbol)
    return ticker.history(period=period, interval=interval)


def fetch_stock_info(symbol: str) -> dict:
    """銘柄の基本情報・財務指標を取得する.

    Args:
        symbol: ティッカーシンボル

    Returns:
        yfinance の info 辞書（取得失敗時は空辞書）
    """
    try:
        return yf.Ticker(symbol).info
    except Exception:  # noqa: BLE001
        return {}


def _fmt_large(value: float | None) -> str:
    """大きな数値を T / B / M / K のサフィックスで短縮表示する.

    Args:
        value: 数値（None の場合は "—" を返す）

    Returns:
        整形済み文字列
    """
    if value is None:
        return "—"
    abs_v = abs(value)
    if abs_v >= 1e12:
        return f"{value / 1e12:.2f}T"
    if abs_v >= 1e9:
        return f"{value / 1e9:.2f}B"
    if abs_v >= 1e6:
        return f"{value / 1e6:.2f}M"
    if abs_v >= 1e3:
        return f"{value / 1e3:.2f}K"
    return f"{value:,.2f}"


def _fmt_ratio(value: float | None, digits: int = 2) -> str:
    """倍率・比率を整形する（None は "—"）.

    Args:
        value: 数値
        digits: 小数点以下の桁数

    Returns:
        整形済み文字列
    """
    if value is None:
        return "—"
    return f"{value:,.{digits}f}x"


def _fmt_pct(value: float | None) -> str:
    """小数の利回りをパーセント表示にする（None は "—"）.

    Args:
        value: 小数形式の数値 (例: 0.015 → "1.50%")

    Returns:
        整形済み文字列
    """
    if value is None:
        return "—"
    return f"{value * 100:.2f}%"


def _compact_metrics_html(items: list[tuple[str, str]]) -> str:
    """ラベルと値のペアをコンパクトな横並びHTMLに変換する.

    Args:
        items: (ラベル, 値) のリスト

    Returns:
        Streamlit の st.markdown に渡すHTML文字列
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
    """ローソク足トレースを追加する.

    Args:
        fig: 追加先の Figure
        df: OHLCV データ
        symbol: ティッカーシンボル
    """
    fig.add_trace(
        go.Candlestick(
            x=df.index,
            open=df["Open"],
            high=df["High"],
            low=df["Low"],
            close=df["Close"],
            increasing=dict(
                line=dict(color=UP_COLOR, width=1),
                fillcolor=UP_COLOR,
            ),
            decreasing=dict(
                line=dict(color=DOWN_COLOR, width=1),
                fillcolor=DOWN_COLOR,
            ),
            name=symbol,
            hoverlabel=dict(bgcolor=PANEL_BG),
        ),
        row=1,
        col=1,
    )


def _add_area(fig: go.Figure, df: pd.DataFrame, symbol: str) -> None:
    """エリアグラフトレースを追加する.

    Args:
        fig: 追加先の Figure
        df: OHLCV データ
        symbol: ティッカーシンボル
    """
    is_up = df["Close"].iloc[-1] >= df["Close"].iloc[0]
    line_color = UP_COLOR if is_up else DOWN_COLOR
    fill_color = UP_FILL if is_up else DOWN_FILL


    # ベースライン（最安値）を下限にfillすることで自然なグラデーション感を出す
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
                f"終値: %{{y:,.2f}}<extra>{symbol}</extra>"
            ),
        ),
        row=1,
        col=1,
    )

def _get_rangebreaks(df: pd.DataFrame) -> list[dict]:
    """取引のない日（土日・祝日など）を rangebreaks 形式で返す.

    実際のデータに存在しない日付を全日程と比較して特定するため、
    国や市場の祝日を問わず正確に除外できる。

    Args:
        df: OHLCV データ（index が DatetimeIndex）

    Returns:
        Plotly の rangebreaks に渡す辞書リスト
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
    """株価チャート（ローソク足 or エリア）+ 出来高を生成する.

    Args:
        df: OHLCV データを含むDataFrame
        symbol: ティッカーシンボル
        period_label: 表示用の期間ラベル
        chart_type: "ローソク足" または "エリア"

    Returns:
        Plotly の Figure オブジェクト
    """
    fig = make_subplots(
        rows=2,
        cols=1,
        shared_xaxes=True,
        vertical_spacing=0.04,
        row_heights=[0.72, 0.28],
    )

    # 1週は夜間ギャップ対策としてx軸をカテゴリ文字列で扱う
    use_category = period_label == "1週"
    if use_category:
        df = df.copy()
        df.index = df.index.strftime("%Y-%m-%d %H:%M")

    if chart_type == "エリア":
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
            name="出来高",
            marker=dict(color=bar_colors, line=dict(width=0)),
            showlegend=False,
            hovertemplate="出来高: %{y:,.0f}<extra></extra>",
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
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            bordercolor="rgba(0,0,0,0)",
        ),
    )
    if use_category:
        fig.update_xaxes(
            type="category",
            showgrid=False,
            zeroline=False,
            showspikes=True,
            spikecolor=SPIKE_COLOR,
            spikethickness=1,
            spikedash="dot",
            spikesnap="cursor",
            tickfont=dict(color=SUBTEXT_COLOR, size=11),
            nticks=6,
        )
    else:
        fig.update_xaxes(
            showgrid=False,
            zeroline=False,
            showspikes=True,
            spikecolor=SPIKE_COLOR,
            spikethickness=1,
            spikedash="dot",
            spikesnap="cursor",
            tickfont=dict(color=SUBTEXT_COLOR, size=11),
            rangebreaks=_get_rangebreaks(df),
        )
    fig.update_yaxes(
        gridcolor=GRID_COLOR,
        zeroline=False,
        showspikes=False,
        tickfont=dict(color=SUBTEXT_COLOR, size=11),
        side="right",
    )
    fig.update_yaxes(title_text="", row=1, col=1)
    fig.update_yaxes(title_text="", row=2, col=1)

    return fig


def sync_query_params(symbol: str, period: str, chart: str) -> None:
    """URLのクエリパラメータを現在の選択に同期する.

    Args:
        symbol: ティッカーシンボル
        period: 期間ラベル
        chart: チャートタイプ
    """
    st.query_params["symbol"] = symbol
    st.query_params["period"] = PERIOD_TO_KEY.get(period, period)
    st.query_params["chart"] = CHART_TO_KEY.get(chart, chart)


def main() -> None:
    """株価ダッシュボードのエントリーポイント."""
    st.set_page_config(
        page_title="株価ダッシュボード",
        page_icon="📈",
        layout="wide",
    )

    # ── クエリパラメータから初期値を読み込む ──────────────────────────
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

    # ── コントロールバー ──────────────────────────────────────────────
    ctl_left, ctl_right = st.columns([3, 1])

    with ctl_left:
        input_symbol = (
            st.text_input(
                "銘柄コード",
                value=init_symbol,
                label_visibility="collapsed",
                placeholder="銘柄コード (例: AAPL / 7203.T)",
            )
            .strip()
            .upper()
        )

    with ctl_right:
        input_chart = st.segmented_control(
            "チャートタイプ",
            options=CHART_TYPES,
            default=init_chart,
            label_visibility="collapsed",
            format_func=lambda x: CHART_ICONS.get(x, x),
        )

    input_period = st.segmented_control(
        "期間",
        options=list(PERIODS.keys()),
        default=init_period,
        label_visibility="collapsed",
    )

    # 入力が変わったらURLに反映
    resolved_period: str = input_period or init_period  # type: ignore[assignment]
    resolved_chart: str = input_chart or init_chart  # type: ignore[assignment]

    if (
        input_symbol != init_symbol
        or resolved_period != init_period
        or resolved_chart != init_chart
    ):
        sync_query_params(input_symbol, resolved_period, resolved_chart)

    symbol = input_symbol or DEFAULT_SYMBOL
    period_label = resolved_period
    chart_type = resolved_chart
    period_cfg = PERIODS[period_label]

    # ── データ取得 ────────────────────────────────────────────────────
    with st.spinner(f"{symbol} のデータを取得中..."):
        df = fetch_stock_data(
            symbol,
            period_cfg["period"],
            period_cfg["interval"],
        )
        info = fetch_stock_info(symbol)

    if df is None or df.empty:
        st.error(
            f"**{symbol}** のデータを取得できませんでした。"
            "銘柄コードを確認してください。",
        )
        return

    # ── 現在値（グラフ上） ────────────────────────────────────────────
    latest = df["Close"].iloc[-1]

    # 期間に応じた比較基準と比較ラベルを決定
    _delta_labels: dict[str, str] = {
        "1日": "前日比",
        "1週": "1週前比",
        "1ヶ月": "1ヶ月前比",
        "6ヶ月": "6ヶ月前比",
        "1年": "1年前比",
        "5年": "5年前比",
        "10年": "10年前比",
    }
    delta_label = _delta_labels.get(period_label, "前日比")

    if period_label == "1日":
        # 前日終値を info から取得（分足DFの先頭は当日始値付近のため不適切）
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

    # ── チャート ──────────────────────────────────────────────────────
    fig = build_chart(df, symbol, period_label, chart_type)
    st.plotly_chart(fig, use_container_width=True)

    # ── サブメトリクス（グラフ下・コンパクト） ────────────────────────
    mkt_cap = info.get("marketCap")
    trailing_pe = info.get("trailingPE")
    forward_pe = info.get("forwardPE")
    pbr = info.get("priceToBook")
    div_yield = info.get("dividendYield")
    eps = info.get("trailingEps")
    week52_high = info.get("fiftyTwoWeekHigh")
    week52_low = info.get("fiftyTwoWeekLow")
    currency_label = currency or "—"

    sub_items: list[tuple[str, str]] = [
        ("期間高値", f"{df['High'].max():,.2f}"),
        ("期間安値", f"{df['Low'].min():,.2f}"),
        ("直近出来高", f"{df['Volume'].iloc[-1]:,.0f}"),
        ("時価総額", _fmt_large(mkt_cap)),
        ("PER 実績", _fmt_ratio(trailing_pe)),
        ("PER 予想", _fmt_ratio(forward_pe)),
        ("PBR", _fmt_ratio(pbr)),
        ("配当利回り", _fmt_pct(div_yield)),
        ("EPS 実績", _fmt_large(eps) if eps is not None else "—"),
        ("52週高値", f"{week52_high:,.2f}" if week52_high else "—"),
        ("52週安値", f"{week52_low:,.2f}" if week52_low else "—"),
        ("通貨", currency_label),
    ]
    st.markdown(_compact_metrics_html(sub_items), unsafe_allow_html=True)


if __name__ == "__main__":
    main()
