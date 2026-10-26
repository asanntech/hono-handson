#!/usr/bin/env bash
# 現在の HEAD を /my-code-review でレビュー済みとして記録する。require-review.sh がこの印を見て push を通す。
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
git rev-parse HEAD > "$(git rev-parse --git-path my-code-review-head)"
echo "レビュー済みとして記録しました: $(git rev-parse --short HEAD)"
