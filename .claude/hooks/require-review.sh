#!/usr/bin/env bash
# PreToolUse（Bash）: `git push` と `gh pr create` の前に /my-code-review を実行させる。
# 現在の HEAD がレビュー済みでなければ、終了コード 2 でコマンドを止め、レビューするよう Claude に返す。
# レビュー済みの印は mark-reviewed.sh が .git 内に書く HEAD の SHA。コミットを足すと SHA が変わり、再レビューになる。

cmd=$(jq -r '.tool_input.command // empty')
printf '%s' "$cmd" | grep -Eq '(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+create)' || exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
head=$(git rev-parse HEAD 2>/dev/null) || exit 0
marker=$(git rev-parse --git-path my-code-review-head)
[ "$(cat "$marker" 2>/dev/null)" = "$head" ] && exit 0

# Bash ツールの環境には CLAUDE_PROJECT_DIR がないため、ここで展開した絶対パスを渡す
cat >&2 <<MSG
現在の HEAD（${head:0:7}）はまだレビューしていません。push / PR 作成の前に次の手順を実行してください。

1. /my-code-review スキルで、マージ先ブランチとの差分（git diff <base>...HEAD）をレビューする
2. 指摘をユーザーに報告する。MUST の指摘があれば、修正してコミットし、1 からやり直す
3. 問題がなければ "${CLAUDE_PROJECT_DIR}/.claude/hooks/mark-reviewed.sh" を実行してから、元のコマンドを再実行する
MSG
exit 2
