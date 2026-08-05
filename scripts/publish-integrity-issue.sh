#!/usr/bin/env bash
# Turns a drift failure into something a person actually receives.
#
#   scripts/publish-integrity-issue.sh open  drift.log
#   scripts/publish-integrity-issue.sh close
#
# Why this exists: the charter tells a scheduled agent to "stop and report" when a frozen source
# no longer matches its archive — but it also forbids posting summaries, and a tier-C failure is
# explicitly not allowed to open a pull request. So "report" had no destination, and on 2026-08-04
# the check went red for two days in silence. This is the destination.
#
# Unlike the gaps issue, which is edited in place because its content is a standing work queue,
# this one is opened and closed. An integrity failure is an event: opening the issue notifies,
# closing it says the archive matches again.

set -euo pipefail

ACTION="${1:?open|close required}"
LABEL="source-integrity"
TITLE="Frozen source no longer matches its archive"
DIR="$(dirname "$0")"

gh label create "$LABEL" --color B60205 --description "A pinned or append-only source had a published number rewritten" --force >/dev/null
existing="$(gh issue list --state open --label "$LABEL" --limit 1 --json number --jq '.[0].number // empty')"

run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

if [ "$ACTION" = "close" ]; then
  if [ -n "$existing" ]; then
    gh issue close "$existing" --comment "Every frozen source matches its archive again as of $(date -u +%Y-%m-%d). Closed by the daily job."
    printf '归档完整性恢复正常,已关闭 #%s。\n' "$existing" |
      node "$DIR/notify-pushplus.mjs" "观测台 · 完整性恢复"
    echo "Closed #$existing: sources match again."
  else
    echo "Nothing open; no integrity failure to clear."
  fi
  exit 0
fi

LOG="${2:?drift log required}"
# Only the failing block. The log also carries live boards that moved, which are not failures and
# would bury the one finding that is.
detail="$(sed -n '/no longer matches its archive/,/^$/p' "$LOG" | head -40)"
[ -n "$detail" ] || detail="$(tail -30 "$LOG")"

body="$(cat <<EOF
A source declared \`pinned\` or \`append-only\` had an **already-published number changed or withdrawn**.
This is not a new model and not a board appending results — those pass. It means history was
rewritten under a version that is supposed to be frozen.

Do not re-fetch and do not "fix" the archive. Read the cells first: if every difference says
\`appeared\`, the source is declared with the wrong \`versioning\` and the fix is one line in its
fetcher. If a number moved, the source edited its own past and a human decides what the archive
should say.

\`\`\`text
$detail
\`\`\`

From [this run]($run_url). Closed automatically when the daily check passes again.
EOF
)"

if [ -n "$existing" ]; then
  gh issue edit "$existing" --body "$body" >/dev/null
  echo "Refreshed integrity issue #$existing."
else
  created="$(gh issue create --title "$TITLE" --label "$LABEL" --body "$body")"
  echo "$created"
  existing="${created##*/}"
fi

{
  echo "**冻结源的已发布数字被改写了。**"
  echo
  echo '```'
  printf '%s\n' "$detail" | head -12
  echo '```'
  echo
  echo "先看 cell:如果全是 \`appeared\`,那是 versioning 声明错了(一行修复);如果有 \`changed\`,是上游改了自己的历史,要人判断。"
  echo
  echo "$run_url"
} | node "$DIR/notify-pushplus.mjs" "⚠ 观测台 · 归档完整性失败"
