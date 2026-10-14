#!/usr/bin/env bash
# PostToolUse（Edit / Write）: 編集したファイルに Biome のフォーマットと安全な自動修正をかける。
# 自動で直せない違反が残ったら、終了コード 2 でエラー内容を Claude に返して直させる。
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0

# プロジェクト外のファイル（Claude のメモリなど）は Biome がクラッシュするので対象にしない
case "$file" in
  "$CLAUDE_PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac

# Biome のオプションは package.json の check:file で管理する
if ! out=$(pnpm --silent check:file "$file" 2>&1); then
  echo "$out" >&2
  exit 2
fi
