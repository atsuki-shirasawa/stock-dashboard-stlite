---
name: add-period
description: チャートの期間（3M / 2Y / YTD など）を追加・変更・削除する。PeriodLabel を増やすと constants.ts の 4 つの Record と StockChart の x 軸分岐に漏れなく手を入れる必要があるため、この手順に従う。
---

# 期間（PeriodLabel）の追加

`PeriodLabel` を 1 つ増やすと 3 ファイル・6 箇所に変更が必要。
うち **型で検出できるのは 2 箇所だけ**で、残りは型が通るのに x 軸だけ壊れる。

## 1. 型を追加する

`src/types/stock.ts` の `PeriodLabel` ユニオンに追加する。

```ts
export type PeriodLabel = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "10Y";
```

## 2. constants.ts の 4 つの Record を埋める

いずれも `Record<PeriodLabel, …>` なので、**書き忘れると `npm run build`（`tsc -b`）が落ちて検出できる**。
`PERIOD_FROM_KEY` は `PERIOD_TO_KEY` から自動生成されるので手を入れない。

| 定数 | 値 | 備考 |
| --- | --- | --- |
| `PERIODS` | `{ period, interval }` | Yahoo Finance API に渡す `range` と `interval` |
| `PERIOD_DELTA_MS` | 期間の長さ(ms) | `date` パラメータ指定時の `period1` 算出に使う |
| `DELTA_LABELS` | `"vs 3M ago"` 等 | `PriceHeader` の騰落率ラベル |
| `PERIOD_TO_KEY` | `"3mo"` 等 | URL の `period=` に載る小文字キー |

**`PERIODS` の記述順がそのままボタンの並び順になる**（`PeriodSelector` が
`Object.keys(PERIODS)` を使うため）。短い期間から順に、正しい位置に挿入する。

### interval の選び方

Yahoo Finance には interval ごとに取得可能な期間の上限がある。長い期間に細かい
interval を指定すると**データが空で返る**（型エラーにはならない）。

| interval | 取得上限の目安 | この repo での使用 |
| --- | --- | --- |
| `5m` | 約 60 日 | 1D |
| `30m` | 約 60 日 | 1W |
| `1d` | 制限なし | 1M / 6M / 1Y |
| `1wk` | 制限なし | 5Y |
| `1mo` | 制限なし | 10Y |

## 3. StockChart.tsx の x 軸分岐を決める（型で検出できない箇所）

`src/components/StockChart.tsx` の以下 3 箇所は `periodLabel` のリテラル比較なので、
**追加した期間はどの分岐にも入らず、暗黙に「日足扱い」になる**。意図した分岐か必ず確認する。

1. `getRangebreaks()` の早期 return — 現在 `periodLabel === "5Y" || periodLabel === "10Y"` で `[]` を返す
2. `useCategory` — 現在 `periodLabel === "1W"` のみ。カテゴリ軸にして夜間の空白を潰す
3. `sessionRange` — 現在 `periodLabel === "1D"` のみ。当日のセッション時間で x 軸範囲を固定

interval からの判断基準:

| 追加する期間の interval | 取るべき方針 |
| --- | --- |
| 日足 (`1d`) | 変更不要（欠損カレンダー日を列挙する既定の rangebreaks が効く） |
| 分足 (`5m` / `30m`) | 夜間ギャップが出るので `useCategory` に追加するか検討 |
| 週足・月足 (`1wk` / `1mo`) | `getRangebreaks()` の早期 return に追加（ギャップは許容） |

## 4. ドキュメントを更新する

期間の一覧が 2 箇所に書かれている。両方直す。

- `README.md` の「URL parameters」表の `period` 行
- `CLAUDE.md` の「URL params」節および「Plotly integration」節の期間別の記述

## 5. 検証する

```bash
npm run build   # tsc -b で Record の書き漏れを検出
npm run lint
npm run dev     # 追加した期間と、隣接する期間の両方を目視確認
```

目視では以下を確認する:

- 追加した期間のチャートが空になっていない（interval の上限超過）
- x 軸に不自然な空白や重複した目盛りが出ていない
- `?period=<新キー>` で直接開いても復元される（`PERIOD_FROM_KEY` 経由）
- ボタンの並び順が期間の長さ順になっている

## 期間を削除する場合

上記の逆を行ったうえで、`DEFAULT_PERIOD`（`constants.ts`）が削除対象を
指していないか確認する。加えて、既存の共有 URL に古いキーが残っていても
`readParams()` が `PERIOD_FROM_KEY[key] ?? DEFAULT_PERIOD` でフォールバックするため、
クラッシュはしないが**黙って別の期間が表示される**点に注意する。
