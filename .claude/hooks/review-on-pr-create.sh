#!/usr/bin/env bash
# PostToolUse（Bash）: gh pr create で PR を作ったら、/my-code-review <PR番号> を実行するよう Claude に指示する。
# hook からスキルは直接起動できないため、additionalContext で Claude に実行を促す。
# ドラフトかどうかは状況によるため問わない。

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+create' || exit 0

# gh pr create は成功すると作成した PR の URL を標準出力に出す。URL がなければ PR は作られていないので何もしない
output=$(printf '%s' "$input" | jq -r '.tool_response.stdout // empty')
number=$(printf '%s' "$output" | grep -Eo '/pull/[0-9]+' | tail -1 | grep -Eo '[0-9]+')
[ -n "$number" ] || exit 0

jq -n --arg n "$number" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("PR #" + $n + " を作成しました。続けて /my-code-review " + $n + " を実行し、レビュー結果を PR にコメントしてください。指摘はユーザーに報告し、MUST の指摘があれば修正を提案してください。")
  }
}'
