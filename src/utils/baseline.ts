import type { OHLCVRow } from "../types/stock";

/**
 * チャートの色判定に使うベースラインを返す。
 * 優先順位: previousClose (meta由来) → rows[-2].close（直前バー終値） → rows[0].close
 * ※ 日本株など previousClose が取得できない場合、rows[-2].close で近似する
 */
export function getColorBaseline(
	rows: OHLCVRow[],
	previousClose?: number,
): number {
	return previousClose ?? rows[rows.length - 2]?.close ?? rows[0]?.close ?? 0;
}
