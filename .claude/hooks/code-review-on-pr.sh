#!/usr/bin/env bash
# PostToolUse（Bash）: PR を作成・更新したら、/code-review で PR にレビューコメントを残させる。
# フックからスラッシュコマンドは実行できないので、終了コード 2 で Claude に実行を指示する。
# open な PR がないブランチへの push は対象にしない（push してから PR を作る流れでもレビューは 1 回になる）。
set -uo pipefail

cmd=$(jq -r '.tool_input.command // empty')

case "$cmd" in
  *"gh pr create"*) action="作成" ;;
  *"git push"*) action="更新" ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0

pr=$(gh pr view --json number,state -q 'select(.state == "OPEN") | .number' 2>/dev/null)
[ -z "$pr" ] && exit 0

printf 'PR #%s を%sしました。Skill ツールで code-review を引数 "%s --comment" で実行し、指摘を PR に残してください。指摘の修正はユーザーの判断を待ってから行ってください。\n' "$pr" "$action" "$pr" >&2
exit 2
