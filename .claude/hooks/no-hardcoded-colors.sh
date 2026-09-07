#!/usr/bin/env bash
# PostToolUse(Edit|Write): src/components 配下のカラーコード直書きを検出して差し戻す。
# 色は src/constants.ts の LIGHT_THEME / DARK_THEME トークン経由で参照する規約
# （直書きするとライト/ダークの一方だけ壊れるため）。
set -u

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] || exit 0

case "$file" in
	*/src/components/*) ;;
	*) exit 0 ;;
esac
[ -f "$file" ] || exit 0

if hits=$(grep -nE '#[0-9a-fA-F]{3,8}' "$file"); then
	{
		echo "カラーコードの直書きを検出しました: $file"
		printf '%s\n' "$hits"
		echo
		echo "色は src/constants.ts の Theme トークン (useTheme() 経由) を使ってください。"
		echo "必要な色が無い場合は Theme インターフェースにトークンを追加し、"
		echo "LIGHT_THEME と DARK_THEME の両方に値を定義してください。"
	} >&2
	exit 2
fi
exit 0
