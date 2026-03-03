/**
 * 価格数値を通貨に応じた桁数でフォーマットする。
 * JPY: 小数なし / その他: 小数2桁
 */
export function formatPrice(n: number, isJpy: boolean): string {
	const digits = isJpy ? 0 : 2;
	return n.toLocaleString(undefined, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
}
