#!/usr/bin/env bash
# Opens or updates the pull request carrying an Artificial Analysis re-read, and pushes a WeChat
# notice that it is waiting. Separate branch from the daily source refresh: the two move on
# different schedules and for different reasons, and sharing a branch would let an on-demand AA
# fetch silently rewrite a pending board refresh.
#
#   scripts/open-aa-pr.sh <checks-output-file>

set -euo pipefail

CHECKS="${1:?checks output file required}"
BRANCH="auto/refresh-aa"
TITLE="Refresh Artificial Analysis parameters"
DIR="$(dirname "$0")"

# Hands off a pull request somebody is deciding on. This branch is force-pushed, so without this
# check a refresh would delete work committed onto it by a reviewer — which is not hypothetical:
# PR #48 carried a hand-written reconciliation of the four catalog values this refresh disagreed
# with, as a commit on this branch. See scripts/pr-engaged.sh for the full reasoning.
#
# Checked before any work, not just before the push: everything below is a snapshot that tomorrow's
# run reproduces, so there is nothing to save by doing it and then throwing it away.
engaged_pr="$(bash "$DIR/pr-hands-off.sh" "$BRANCH")"
if [ -n "$engaged_pr" ]; then
  # Told to the caller, not just to the log: the workflow's self-merge step must not fire on a
  # pull request this run deliberately did not touch.
  echo "handsoff=yes" >> "${GITHUB_OUTPUT:-/dev/null}"
  echo "::warning::PR #$engaged_pr is waiting on a person; leaving $BRANCH alone. AA re-measures continuously, so tomorrow's run will refresh it once that pull request is merged or closed."
  {
    echo "### AA refresh paused"
    echo
    echo "[PR #${engaged_pr}](${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/pull/${engaged_pr}) has human engagement, so this run left the branch alone."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

# Describe the change before committing it: this compares the working tree against HEAD, so it
# has to run while the change is still uncommitted. It goes at the top of the pull request body,
# where a reviewer who cannot check an alias mapping can still check a score.
[ -s change.md ] || node scripts/describe-change.mjs > change.md || echo "(could not describe the change)" > change.md

# Every AA model the catalog does not carry *and the archive can already fill*, drafted from the
# batch that just landed. The numbers in a model record all have a source; only the display name,
# colour and tags do not, and those are what the draft leaves blank. Without this the pull request
# says "AA has new parameters" and the reader still has to write the record from scratch.
#
# --with-evidence, since 2026-08-07. Unfiltered this was 213 records and 200,061 bytes, of which
# 118 were for models with no observation row — each one carrying the drafter's own warning not to
# add it yet. That body could not be passed to `gh` at all (see scripts/gh-body.mjs), and even at a
# size that could, a reviewer scrolling 200KB to find the nine records worth writing is a reviewer
# who stops reading. The held-back count is printed in the draft itself.
node scripts/draft-model-record.mjs --all-new --with-evidence > drafts.md 2>/dev/null || echo "(could not draft records)" > drafts.md

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git checkout -B "$BRANCH"
# app/model-data.ts is here because scripts/reconcile-aa.mjs may have written to it before this
# script ran. It is unchanged when the reconciler found nothing or refused, so adding it
# unconditionally is a no-op on those days rather than a second code path.
git add data/sources app/observations.generated.ts app/model-data.ts
git commit -m "Refresh the Artificial Analysis parameter batch

Re-read on request via .github/workflows/aa-refresh.yml. AA re-measures speed,
latency and cost continuously, so this is a snapshot, not a correction: the
catalog is only wrong where check:models says so.
"
git push --force origin "$BRANCH"

reconcile="$( [ -s reconcile.md ] && sed '/^<!--/d' reconcile.md || echo "_The reconciler did not run._" )"

body="$(sed '/^<!--/d' change.md)

## Catalog reconciliation

$reconcile

An on-demand re-read of Artificial Analysis. AA is not part of the daily refresh because it
re-measures continuously; this branch exists so that adding a model does not require a person with
the API key at a terminal.

**If \`check:models\` is red below, this pull request is waiting for you** — the reconciler
refused something, and what it refuses is the part that is a judgement rather than a re-measure.
When it is green the run merges itself, and you are reading this only because you went looking.
A flagged value is not automatically a defect in this diff: AA re-measuring speed is normal, and
the question is whether the catalog number or the archived one is the stale side. Batch 08
corrected 43 catalog values this way, two of which had been quoted as evidence *against* the
source.

\`\`\`
$(cat "$CHECKS")
\`\`\`

Checks ran inside the workflow because a pull request opened with \`GITHUB_TOKEN\` does not trigger
CI. Push any commit to this branch to get a real CI run.

---

## Catalog records this makes possible

$(cat drafts.md)"

# Never `--body "$body"`. The body carries a drafted record per uncollected model and outgrew the
# 128 KiB Linux caps on a single argv entry on 2026-08-07, so `gh` could not be started at all.
printf '%s' "$body" | node "$DIR/gh-body.mjs" pr-body.md

repo_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}"
existing="$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty')"
if [ -n "$existing" ]; then
  gh pr edit "$existing" --title "$TITLE" --body-file pr-body.md >/dev/null
  url="$(gh pr view "$existing" --json url --jq .url)"
  echo "Updated PR #$existing"
# A repository can forbid Actions from opening pull requests — Settings → Actions → General →
# "Allow GitHub Actions to create and approve pull requests". That setting is off by default, and
# the work is already safe on a branch by this point, so losing the whole job over the last step
# would throw away a good fetch. Report the branch and let a human open it.
elif url="$(gh pr create --head "$BRANCH" --title "$TITLE" --body-file pr-body.md 2>pr-error.txt)"; then
  echo "$url"
else
  opened="no"
  reason="$(tr '\n' ' ' < pr-error.txt)"
  url="$repo_url/compare/$BRANCH?expand=1"
  echo "::warning::Could not open the pull request ($reason); the branch is pushed. Open it at $url"
fi

# The message has to describe what happened, not what was meant to happen. The first real run of
# this workflow could not open its pull request, and the notification still announced one waiting
# for review, with a link to a compare view for a branch that was deleted an hour later. A
# notification that is wrong about its own outcome is worse than none: it spends the one thing
# this whole channel runs on, which is being believed.
if [ "${opened:-yes}" = "yes" ]; then
  # No notification on the happy path. A pull request that exists is its own record, and the
  # channel is now reserved for two things: the site gained a model, and something is broken.
  echo "Opened $url"
else
  {
    echo "AA 参数已重读并推到分支 \`$BRANCH\`,但 **PR 没能自动创建**。"
    echo
    echo "原因:$reason"
    echo
    echo "数据是安全的,分支还在。手动开:"
    echo "$url"
  } | node "$DIR/notify-pushplus.mjs" "⚠ 观测台 · AA 已刷新,PR 未创建"
fi
