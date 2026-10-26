#!/usr/bin/env bash
# PreToolUse（Bash）: PR をドラフトで作らせ、ドラフトを解除する前に /my-code-review <PR番号> を実行させる。
# git push と gh pr create --draft は止めない。--draft なしの gh pr create と、gh pr ready を止める。
# レビュー済みの印は mark-reviewed.sh が .git 内に書く HEAD の SHA。コミットを足すと SHA が変わり、再レビューになる。

cmd=$(jq -r '.tool_input.command // empty')

if printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+create'; then
  printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])(--draft|-d)([[:space:]=]|$)' && exit 0
  echo "PR はドラフトで作成してください（gh pr create --draft）。レビューは、ドラフトを解除する前（gh pr ready）に行います。" >&2
  exit 2
fi

printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+ready' || exit 0
printf '%s' "$cmd" | grep -Eq -- '--undo' && exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
head=$(git rev-parse HEAD 2>/dev/null) || exit 0
marker=$(git rev-parse --git-path my-code-review-head)
[ "$(cat "$marker" 2>/dev/null)" = "$head" ] && exit 0

# Bash ツールの環境には CLAUDE_PROJECT_DIR がないため、ここで展開した絶対パスを渡す
cat >&2 <<MSG
現在の HEAD（${head:0:7}）はまだレビューしていません。ドラフトを解除する前に、次の手順を実行してください。

1. HEAD まで push したうえで、/my-code-review <PR番号> を実行し、レビュー結果を PR にコメントする
2. 指摘をユーザーに報告する。MUST の指摘があれば、修正してコミットと push をし、1 からやり直す
3. 問題がなければ "${CLAUDE_PROJECT_DIR}/.claude/hooks/mark-reviewed.sh" を実行してから、元のコマンドを再実行する
MSG
exit 2
