#!/usr/bin/env bash
# PostToolUse(Edit|Write): 編集された .ts/.tsx を Biome で自動整形する。
# 自動修正できない error が残った場合は exit 2 で Claude に差し戻す
# （CI の `npm run lint` と同じ判定。warning は Biome 同様 exit 0 で通す）。
set -u

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] || exit 0

case "$file" in
	*.ts | *.tsx) ;;
	*) exit 0 ;;
esac

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bin="$root/node_modules/.bin/biome"
# 依存未インストール時は何もしない（npx でレジストリから取得させない）
[ -x "$bin" ] || exit 0

if ! out=$("$bin" check --write "$file" 2>&1); then
	printf '%s\n' "$out" >&2
	exit 2
fi
exit 0
