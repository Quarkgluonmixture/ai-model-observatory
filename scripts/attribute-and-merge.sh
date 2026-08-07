#!/usr/bin/env bash
# Applies the attribution gate's proposals, and merges them when nothing about the result needs a
# person. Run by .github/workflows/upstream.yml after the source refresh.
#
# This is the step that used to be "somebody writes an alias by hand". It is allowed to reach
# production unattended because three independent things have to agree, and each one has already
# caught a real error in this project:
#
#   1. the gate itself refused everything it could not settle on evidence, and its rules are
#      replayed against 239 human decisions in CI on every commit;
#   2. the full contract passes, including the cross-source disagreement gate and the
#      one-source-one-cell gate — the two checks that exist because a report was not enough;
#   3. `describe-change` reports that no number already on the site moved. An alias only ever
#      ADDS cells; if one moves, something attached to a cell that was already filled, and that
#      is a different event that a person should see.
#
# Anything else — a failed check, a moved number, an exemption written to make it pass — leaves the
# branch open as a pull request. The PR is the record either way: nothing here is silent.
#
#   scripts/attribute-and-merge.sh

set -euo pipefail

BRANCH="auto/attribution"

node --experimental-strip-types scripts/propose-attribution.mjs > attribution.md || true
proposed="$(sed -n 's/.*<!-- attribution-proposed: \([0-9]*\) -->.*/\1/p' attribution.md)"

if [ -z "$proposed" ] || [ "$proposed" = "0" ]; then
  echo "No published string could be attributed on evidence today."
  exit 0
fi

node --experimental-strip-types scripts/propose-attribution.mjs --write > /dev/null
npm run --silent ingest > /dev/null

# Before committing, while the change is still uncommitted: this is the report a reader can check
# even though the alias table is opaque to them — "Qwen3.8 Max gained 12 cells: GPQA 92.6".
node scripts/describe-change.mjs > change.md || echo "(could not describe the change)" > change.md
moved="$(sed -n 's/.*<!-- changed-cells: [0-9]* models, \([0-9]*\) moved -->.*/\1/p' change.md)"

green=yes
set +e
{
  npm run --silent lint && echo "lint ok"
  npm run --silent check:data
  npm run --silent check:models
  npm run --silent check:prices
  npm run --silent build > /dev/null && echo "build ok"
} > checks.txt 2>&1 || green=no
set -e

# An exemption is exactly the judgement a human owes. The gate may not write one, and if a diff
# contains one, something else did.
if git diff --name-only | grep -q 'data/model-aliases.json' &&
   git diff data/model-aliases.json | grep -qE '^\+.*"(acknowledgedDisagreements|mergedInOneSource)"'; then
  echo "An exemption was written to make this pass — that is a human's call."
  green=no
fi

# Before touching the remote: is somebody already deciding on the pull request this branch carries?
#
# This branch is force-pushed and its body rewritten every morning, which is right while nobody is
# looking at it — one pull request that always reflects today's proposals beats a queue of stale
# ones. It stops being right the moment a person starts reading. PR #45 asked whether Claude Opus
# 4.8's and GPT-5.5's arc-agi-2 cells should change hands, was correctly held back by the
# three conditions for exactly that reason, and would have had its contents replaced underneath the
# owner the next morning — the decision moving while the decision is being made.
#
# The signal is `--any-open`, not "somebody commented". This script merges and deletes its own
# branch whenever the contract is green and no published number moved, so an **open** pull request
# here is not a change awaiting review — it is this gate having already decided it cannot decide.
# A person owes a judgement from that moment, not from the moment they start typing, and PR #45 is
# the proof: nobody had commented on it, because they were still thinking.
#
# Nothing is lost by waiting. The gate is deterministic, so every proposal it makes today it makes
# again tomorrow, and the run resumes on its own the moment that pull request is merged or closed.
# ⚠ The cost, stated rather than discovered: while it is open, new proposals queue behind it. That
# is the correct failure mode for a system whose premise is that a wrong attribution costs more
# than a late one — a stuck queue is visible, a rewritten judgement call is not — but it does mean
# an unanswered pull request here stops the alias pipeline, not just itself.
open_pr="$(bash "$(dirname "$0")/pr-hands-off.sh" "$BRANCH" --any-open)"
if [ -n "$open_pr" ]; then
  echo "::warning::PR #$open_pr is waiting on a person; not overwriting it. Today's $proposed proposal(s) will be re-made after it is merged or closed."
  {
    echo "### Attribution paused"
    echo
    echo "[PR #${open_pr}](${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/pull/${open_pr}) has human engagement, so this run left it alone."
    echo "${proposed} proposal(s) are held until it is merged or closed."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  echo "merged=no" >> "${GITHUB_OUTPUT:-/dev/null}"
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -B "$BRANCH"
git add data/model-aliases.json app/observations.generated.ts
git commit -m "Attribute $proposed published string(s) to a catalog model

Written by scripts/propose-attribution.mjs. Every entry carries the evidence that
settled it; anything the evidence did not settle is in the escalation list and
stays unmapped, which costs nothing.
"
git push --force origin "$BRANCH"

body="$(sed '/^<!--/d' change.md)

## What was attributed, and on what evidence

$(sed '/^<!--/d' attribution.md)

## Checks

\`\`\`text
$(cat checks.txt)
\`\`\`
"

# --body-file, never --body: the escalation list grows with every unattributable string the archive
# collects, and an argv entry over 128 KiB fails before `gh` starts. See scripts/gh-body.mjs.
printf '%s' "$body" | node scripts/gh-body.mjs pr-body.md

gh pr create --base main --head "$BRANCH" --title "Attribute $proposed published string(s)" --body-file pr-body.md \
  || gh pr edit "$BRANCH" --title "Attribute $proposed published string(s)" --body-file pr-body.md

if [ "$green" = "yes" ] && [ "${moved:-1}" = "0" ]; then
  gh pr merge "$BRANCH" --merge --delete-branch
  echo "merged=yes" >> "${GITHUB_OUTPUT:-/dev/null}"
else
  echo "Left open for review: green=$green moved=${moved:-unknown}"
  echo "merged=no" >> "${GITHUB_OUTPUT:-/dev/null}"
fi
