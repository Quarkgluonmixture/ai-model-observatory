#!/usr/bin/env bash
# Turns a drift failure into something a person actually receives.
#
#   scripts/publish-integrity-issue.sh open  drift.log
#   scripts/publish-integrity-issue.sh close
#   scripts/publish-integrity-issue.sh --self-test     # no network, no gh, no push
#
# Why this exists: the charter tells a scheduled agent to "stop and report" when a frozen source
# no longer matches its archive — but it also forbids posting summaries, and a tier-C failure is
# explicitly not allowed to open a pull request. So "report" had no destination, and on 2026-08-04
# the check went red for two days in silence. This is the destination.
#
# Unlike the gaps issue, which is edited in place because its content is a standing work queue,
# this one is opened and closed. An integrity failure is an event: opening the issue notifies,
# closing it says the archive matches again.
#
# ## The alarm used to fail in proportion to what it was alarming about
#
# Until 2026-08-14 the detail block was `sed -n '/.../,/^$/p' "$LOG" | head -40`. `head` closes the
# pipe once it has its 40 lines, `sed` takes SIGPIPE, `set -o pipefail` turns that into a non-zero
# status for the assignment, and `set -e` exits the script — before the issue is opened and before
# the push is sent. The workflow step wraps this call in `|| echo "::warning::"`, so the failure
# renders as a green tick.
#
# It only triggers once sed's output passes the pipe buffer, which is why it survived every small
# drift: measured 2026-08-14, a ~1KB block exits 0 and a ~400KB block exits 141. On that morning
# LiveBench moved 69 cells, the block was large, and the run printed `sed: couldn't flush stdout:
# Broken pipe` and sent nothing at all — no issue, no WeChat — while the step stayed green.
#
# So: awk, which caps its own output and never closes a pipe on a process that is still writing.
# And a `--self-test` that replays the 2026-08-14 shape, because a notifier nobody asserts is a
# notifier nobody knows about until the morning it is needed.

set -euo pipefail

ACTION="${1:?open|close|--self-test required}"
LABEL="source-integrity"
TITLE="Frozen source no longer matches its archive"
DIR="$(dirname "$0")"

# Only the failing block, capped at 40 lines. The log also carries live boards that moved, which
# are not failures and would bury the one finding that is.
#
# This reproduces `sed -n '/A/,/^$/p'` rather than simplifying it: the range restarts, so a log
# naming two frozen sources yields two blocks, and the terminating blank line is part of the block.
# The cap is applied inside the same process, which is the whole point — see the header.
extract_detail() {
  awk '
    /no longer matches its archive/ { inblock = 1 }
    inblock { print; count++ }
    inblock && /^$/ { inblock = 0 }
    count >= 40 { exit }
  ' "$1"
}

# Every outward call goes through one of these two, so `--self-test` can run the whole path —
# argument handling, block extraction, body assembly, both notifications — without touching GitHub
# or a phone. A dry run that stops short of the body is a dry run that would not have caught the
# bug this file was rewritten for.
if [ -n "${INTEGRITY_ISSUE_DRY_RUN:-}" ]; then
  gh() { echo "[dry-run] gh $*" >&2; }
  notify() { cat >/dev/null; echo "[dry-run] push: $1" >&2; }
else
  notify() { node "$DIR/notify-pushplus.mjs" "$1"; }
fi

if [ "$ACTION" = "--self-test" ]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  failed=0
  check() {
    if [ "$2" = "$3" ]; then
      echo "ok    $1 ($2)"
    else
      echo "FAIL  $1: expected $3, got $2"
      failed=1
    fi
  }

  # 1. The 2026-08-14 shape. 69 moved cells is what the real log carried; 5,000 is well past the
  #    pipe buffer, so this fails loudly on any rewrite that reintroduces a closing reader.
  {
    echo "LiveBench 2026-06-25 no longer matches its archive — 69 cell(s)."
    for i in $(seq 1 5000); do echo "  livebench-python / muse-spark-1.2 changed 12.3 -> 45.6 (row $i)"; done
    echo ""
  } > "$tmp/big.log"
  if detail="$(extract_detail "$tmp/big.log")"; then
    check "a block larger than the pipe buffer is extracted" "$(printf '%s\n' "$detail" | wc -l | tr -d ' ')" "40"
  else
    echo "FAIL  extract_detail died on a large block — this is the 2026-08-14 regression"
    failed=1
  fi

  # 2. The ordinary case still reads to the blank line rather than to the cap.
  {
    echo "before, unrelated"
    echo "Epoch FrontierMath no longer matches its archive — 3 cell(s)."
    echo "  frontiermath / gpt-5.6-sol changed 41.2 -> 38.9"
    echo "  frontiermath / kimi-k3 appeared 22.0"
    echo ""
    echo "after, unrelated"
  } > "$tmp/small.log"
  check "a small block stops at the blank line" \
    "$(extract_detail "$tmp/small.log" | wc -l | tr -d ' ')" "4"

  # 3. Two frozen sources in one log are two blocks, not one. The range restarting is behaviour the
  #    old sed had and a hand-written state machine is the easiest place to lose it.
  {
    echo "LiveBench no longer matches its archive — 1 cell(s)."
    echo "  a changed"
    echo ""
    echo "unrelated live board moved"
    echo "Epoch no longer matches its archive — 1 cell(s)."
    echo "  b changed"
    echo ""
  } > "$tmp/two.log"
  check "two frozen sources yield two blocks" \
    "$(extract_detail "$tmp/two.log" | wc -l | tr -d ' ')" "6"

  # 4. Nothing to match must come back empty, because empty is what triggers the `tail -30`
  #    fallback below. A version that printed the whole log here would bury the finding instead.
  echo "Vals AI: could not be read — the page changed shape" > "$tmp/none.log"
  check "an availability-only log extracts nothing" \
    "$(extract_detail "$tmp/none.log" | wc -l | tr -d ' ')" "0"

  # 5. And the part the four assertions above still cannot see: the whole script, end to end, on
  #    the log that broke it. Exit status is the assertion.
  if INTEGRITY_ISSUE_DRY_RUN=1 bash "$0" open "$tmp/big.log" >/dev/null 2>&1; then
    echo "ok    the full path runs to completion on the 2026-08-14 log"
  else
    echo "FAIL  the full path exited non-zero on the 2026-08-14 log"
    failed=1
  fi

  if [ "$failed" -ne 0 ]; then echo "self-test FAILED"; else echo "self-test passed"; fi
  exit "$failed"
fi

gh label create "$LABEL" --color B60205 --description "A pinned or append-only source had a published number rewritten" --force >/dev/null
existing="$(gh issue list --state open --label "$LABEL" --limit 1 --json number --jq '.[0].number // empty')"

run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

if [ "$ACTION" = "close" ]; then
  if [ -n "$existing" ]; then
    gh issue close "$existing" --comment "Every frozen source matches its archive again as of $(date -u +%Y-%m-%d). Closed by the daily job."
    printf '归档完整性恢复正常,已关闭 #%s。\n' "$existing" |
      notify "观测台 · 完整性恢复"
    echo "Closed #$existing: sources match again."
  else
    echo "Nothing open; no integrity failure to clear."
  fi
  exit 0
fi

LOG="${2:?drift log required}"
detail="$(extract_detail "$LOG")"
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
  # `awk NR<=12` rather than `head -12` for the reason in the header: nothing here may close a
  # pipe on a writer that is still going.
  printf '%s\n' "$detail" | awk 'NR<=12'
  echo '```'
  echo
  echo "先看 cell:如果全是 \`appeared\`,那是 versioning 声明错了(一行修复);如果有 \`changed\`,是上游改了自己的历史,要人判断。"
  echo
  echo "$run_url"
} | notify "⚠ 观测台 · 归档完整性失败"
