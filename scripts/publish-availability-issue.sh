#!/usr/bin/env bash
# The destination a source that cannot be read never had.
#
#   scripts/publish-availability-issue.sh report drift.log
#   scripts/publish-availability-issue.sh close
#   scripts/publish-availability-issue.sh --self-test     # no network, no gh, no push
#
# ## Why this exists
#
# `check:upstream` exits non-zero for two unrelated events, and until 2026-09-04 only one of them
# had anywhere to go. A frozen source rewriting history opens the `source-integrity` issue and
# pushes. A source that could not be read *at all* printed one `::warning::` into a log and turned
# the whole daily job red.
#
# Measured over the 31 days to 2026-09-04: the daily job went red 12 times and exactly 3 integrity
# issues were opened (08-05, 08-15, 09-04). So roughly nine red days were availability — Vals AI
# timing out at 120s on 09-03, Artificial Analysis' GDPval leaderboard failing to get a Chrome page
# target on 08-31, and so on. Two costs, and the second is the one that bites:
#
#   1. Red became the normal colour of that job, which the workflow's own header says is exactly
#      how a check gets trained into noise.
#   2. `check:heartbeat --github` reports failure on those days, and that is the first thing the
#      scheduled agent reads every morning. An availability blip was reaching the agent as
#      "GitHub's side is broken" and reaching the owner as nothing at all.
#
# ## Why a streak, and why two
#
# A single unreadable run is usually a slow page, not a dead source: the fetchers isolate per
# source and the next morning gets it. Alarming on the first one would push about ten times a
# month for nothing, and GOTCHAS 38 is the record of what that costs — a channel that cries wolf
# is a channel nobody opens.
#
# So the issue is the record and the push is the alarm, and they fire at different thresholds:
# the issue opens on the first failure (editing it later is silent), and WeChat fires only when a
# source reaches TWO CONSECUTIVE runs unreadable. The streak lives in the issue body as an HTML
# comment, because that is the only state this job has that survives to tomorrow without a commit.
# A source that reads again is dropped from the body, so a streak is genuinely consecutive rather
# than a lifetime tally.
#
# The push fires once, on the crossing. A source broken for ten days is one fact, not ten, and it
# is already sitting in an open issue with its own start date.

set -euo pipefail

ACTION="${1:?report|close|--self-test required}"
LABEL="source-availability"
TITLE="A source could not be read"
DIR="$(dirname "$0")"
TODAY="$(date -u +%Y-%m-%d)"

# `<name>: could not be read — <reason>` is fetch-source.mjs's wording. Captured whole, because the
# reason is the useful half: "no answer in 120s" and "headless Chrome did not expose a page target"
# are the same red and completely different jobs to fix.
extract_unreadable() {
  grep -E ': could not be read' "$1" 2>/dev/null | sed 's/^[[:space:]]*//' | sort -u || true
}

# The source name is everything before the first colon. It is the streak key, so it has to be
# stable while the reason moves around — a source that times out one day and 404s the next is one
# unavailable source, not two.
source_name_of() { printf '%s' "${1%%: could not be read*}"; }

if [ -n "${AVAILABILITY_ISSUE_DRY_RUN:-}" ]; then
  gh() { echo "[dry-run] gh $*" >&2; }
  notify() { cat >/dev/null; echo "[dry-run] push: $1" >&2; }
else
  notify() { node "$DIR/notify-pushplus.mjs" "$1"; }
fi

# --- self-test ---------------------------------------------------------------------------------

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

  # 1. The real 09-03 and 08-31 lines, alongside the drift output they arrive buried in.
  {
    echo "LiveBench 2026-06-25 no longer matches its archive — 26 cell(s)."
    echo "  changed  nemotron/livebench-python: archived 15 -> upstream 45"
    echo ""
    echo "Vals AI: could not be read — no answer in 120s (FETCH_TIMEOUT_MS)"
    echo "Artificial Analysis GDPval-AA v2 leaderboard: could not be read — headless Chrome did not expose a page target — set CHROME_PATH?"
  } > "$tmp/mixed.log"
  check "two unreadable sources are extracted from a log that also has drift" \
    "$(extract_unreadable "$tmp/mixed.log" | wc -l | tr -d ' ')" "2"

  # 2. An integrity-only log must yield nothing. If it did not, every integrity failure would also
  #    open an availability issue and the two alarms would stop meaning different things.
  {
    echo "LiveBench 2026-06-25 no longer matches its archive — 3 cell(s)."
    echo "  changed  a/b: archived 1 -> upstream 2"
  } > "$tmp/integrity.log"
  check "an integrity-only log extracts nothing" \
    "$(extract_unreadable "$tmp/integrity.log" | wc -l | tr -d ' ')" "0"

  # 3. The streak key must survive the reason changing. This is the assertion that keeps a flaky
  #    source from resetting its own streak every morning by failing differently.
  a="$(source_name_of "Vals AI: could not be read — no answer in 120s (FETCH_TIMEOUT_MS)")"
  b="$(source_name_of "Vals AI: could not be read — 503 from the origin")"
  check "the streak key ignores the reason" "$a|$b" "Vals AI|Vals AI"

  # 4. Streak arithmetic, which is the whole design. Yesterday's body carries Vals at 1; today Vals
  #    is still down and GDPval has joined. Vals must cross to 2 (and be the only thing that
  #    pushes); GDPval must start at 1 and stay silent.
  cat > "$tmp/prev-body.md" <<'PREV'
<!-- unreadable: Vals AI | first=2026-09-03 | runs=1 -->
PREV
  streaks="$(AVAILABILITY_PREV_BODY="$tmp/prev-body.md" bash "$0" --streaks "$tmp/mixed.log")"
  check "a source down two runs running crosses the threshold" \
    "$(printf '%s\n' "$streaks" | grep -c '^Vals AI|2026-09-03|2|cross$')" "1"
  check "a source down for the first time starts at one and does not push" \
    "$(printf '%s\n' "$streaks" | grep -c '|1|new$')" "1"

  # 5. A source that read fine again must vanish from the state, or "consecutive" is a lie and the
  #    streak becomes a lifetime tally that eventually pushes for a source that is working.
  echo "Vals AI: could not be read — still down" > "$tmp/only-vals.log"
  cat > "$tmp/prev2.md" <<'PREV'
<!-- unreadable: Vals AI | first=2026-09-03 | runs=1 -->
<!-- unreadable: Epoch AI | first=2026-09-01 | runs=3 -->
PREV
  streaks2="$(AVAILABILITY_PREV_BODY="$tmp/prev2.md" bash "$0" --streaks "$tmp/only-vals.log")"
  check "a source that reads again is dropped from the state" \
    "$(printf '%s\n' "$streaks2" | grep -c 'Epoch AI')" "0"

  # 6. And the whole path end to end, on the mixed log, with gh and the push stubbed. Exit status
  #    is the assertion — the same shape publish-integrity-issue.sh's fifth check uses, and for the
  #    same reason: the four above cannot see body assembly or argument handling.
  if AVAILABILITY_ISSUE_DRY_RUN=1 AVAILABILITY_PREV_BODY="$tmp/prev-body.md" \
     bash "$0" report "$tmp/mixed.log" >/dev/null 2>&1; then
    echo "ok    the full report path runs to completion"
  else
    echo "FAIL  the full report path exited non-zero"
    failed=1
  fi
  if AVAILABILITY_ISSUE_DRY_RUN=1 bash "$0" close >/dev/null 2>&1; then
    echo "ok    the close path runs to completion"
  else
    echo "FAIL  the close path exited non-zero"
    failed=1
  fi

  if [ "$failed" -ne 0 ]; then echo "self-test FAILED"; else echo "self-test passed: 8 checks."; fi
  exit "$failed"
fi

# --- streak arithmetic -------------------------------------------------------------------------

# Reads the previous body (from the open issue, or from AVAILABILITY_PREV_BODY under test) and
# today's log, and prints one line per currently-unreadable source:
#
#   <source>|<first-seen>|<consecutive runs>|new|cross|ongoing
#
# Split out as its own mode so the self-test can assert the arithmetic without a GitHub issue —
# the alternative is asserting it through the body, which is how a rewrite of the body's wording
# silently becomes a rewrite of when the alarm fires.
compute_streaks() {
  local log="$1" prev="$2" line name prev_line first runs state
  extract_unreadable "$log" | while IFS= read -r line; do
    [ -n "$line" ] || continue
    name="$(source_name_of "$line")"
    prev_line="$(grep -F "<!-- unreadable: $name | " "$prev" 2>/dev/null | head -1 || true)"
    if [ -n "$prev_line" ]; then
      first="$(printf '%s' "$prev_line" | sed -n 's/.*| first=\([^ ]*\) |.*/\1/p')"
      runs="$(printf '%s' "$prev_line" | sed -n 's/.*| runs=\([0-9]*\) -->.*/\1/p')"
      runs=$((runs + 1))
      # Exactly at the threshold, not at-or-above: the alarm is the crossing. A source that has
      # been down for ten runs is one fact already sitting in an open issue.
      if [ "$runs" -eq 2 ]; then state=cross; else state=ongoing; fi
    else
      first="$TODAY"
      runs=1
      state=new
    fi
    printf '%s|%s|%s|%s\n' "$name" "$first" "$runs" "$state"
  done
}

if [ "$ACTION" = "--streaks" ]; then
  compute_streaks "${2:?log required}" "${AVAILABILITY_PREV_BODY:-/dev/null}"
  exit 0
fi

# --- report / close ----------------------------------------------------------------------------

gh label create "$LABEL" --color FBCA04 --description "A source could not be read at all — availability, not integrity" --force >/dev/null 2>&1 || true
existing="$(gh issue list --state open --label "$LABEL" --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null || true)"
run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

if [ "$ACTION" = "close" ]; then
  if [ -n "$existing" ]; then
    gh issue close "$existing" --comment "Every source was read on $TODAY. Closed by the daily job."
    echo "Closed #$existing: every source readable again."
  else
    echo "Nothing open; every source was readable."
  fi
  exit 0
fi

LOG="${2:?drift log required}"
unreadable="$(extract_unreadable "$LOG")"
if [ -z "$unreadable" ]; then
  exec bash "$0" close
fi

prev_body="$(mktemp)"
trap 'rm -f "$prev_body"' EXIT
if [ -n "${AVAILABILITY_PREV_BODY:-}" ]; then
  cat "${AVAILABILITY_PREV_BODY}" > "$prev_body" 2>/dev/null || true
elif [ -n "$existing" ]; then
  gh issue view "$existing" --json body --jq .body > "$prev_body" 2>/dev/null || true
fi

streaks="$(compute_streaks "$LOG" "$prev_body")"

{
  echo "A source could not be read **at all** on the last daily run. This is availability, not"
  echo "integrity: nothing in the archive is wrong, a page simply did not answer. The refresh"
  echo "isolates each fetcher, so every other source was still collected."
  echo
  echo "⛔ Do not re-transcribe by hand and do not delete the source. A source that stays here for"
  echo "several days is either rate-limiting the runner, has changed shape, or has gone away —"
  echo "and those are three different fixes. The reason column is what tells them apart."
  echo
  echo "| source | unreadable since | consecutive runs |"
  echo "| --- | --- | --- |"
  printf '%s\n' "$streaks" | while IFS='|' read -r name first runs _; do
    [ -n "$name" ] || continue
    echo "| \`$name\` | $first | $runs |"
  done
  echo
  echo "**Today's reasons**"
  echo
  echo '```text'
  printf '%s\n' "$unreadable"
  echo '```'
  echo
  echo "From [this run]($run_url). Closed automatically when every source reads again."
  echo
  printf '%s\n' "$streaks" | while IFS='|' read -r name first runs _; do
    [ -n "$name" ] || continue
    echo "<!-- unreadable: $name | first=$first | runs=$runs -->"
  done
} > "$prev_body.new"

if [ -n "$existing" ]; then
  gh issue edit "$existing" --body-file "$prev_body.new" >/dev/null
  echo "Refreshed availability issue #$existing."
else
  created="$(gh issue create --title "$TITLE" --label "$LABEL" --body-file "$prev_body.new")"
  echo "$created"
fi

# The alarm, separate from the record above. Only sources crossing the second consecutive run.
crossed="$(printf '%s\n' "$streaks" | awk -F'|' '$4 == "cross" { print $1 }')"
if [ -n "$crossed" ]; then
  {
    echo "**有源连续两天读不出来了。**"
    echo
    printf '%s\n' "$crossed" | sed 's/^/- /'
    echo
    echo "不是归档出错,是页面没答应。其他源照常采集,站上的数没受影响。"
    echo "连续两次才推送 —— 一次读不到通常只是慢,第二天自己就好了。"
    echo
    echo '```text'
    printf '%s\n' "$unreadable" | awk 'NR<=8'
    echo '```'
    echo
    echo "$run_url"
  } | notify "⚠ 观测台 · 源连续两天读不出来"
fi
rm -f "$prev_body.new"
