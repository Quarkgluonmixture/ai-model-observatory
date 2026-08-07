#!/usr/bin/env bash
# Adds a catalog record for an upstream model that has earned one, and merges it when nothing about
# the result needs a person. Run by .github/workflows/upstream.yml, after the attribution gate.
#
# This is the last step that used to be "somebody writes a ModelRecord by hand", and it is the most
# dangerous thing in this repository, so the reasons it is allowed to run unattended are written
# out rather than assumed:
#
#   1. `scripts/propose-model.mjs` proposes nothing it cannot defend. Text output only, read from
#      `architecture.output_modalities` rather than from a name; published in the last 60 days by a
#      provider the catalog already resolves into; absent from the catalog; and carrying more
#      archived cells than the models on the board average. The floor is arithmetic, recomputed
#      each run, and its matching rule is replayed against every catalog model by
#      `scripts/lib/upstream-evidence.mjs --self-test`.
#   2. The full contract passes, including the two gates that exist because a report was not
#      enough — cross-source disagreement, and one source resolving two strings into one cell.
#   3. `describe-change` reports that no number already on the site moved. A new record should only
#      ever ADD cells.
#   4. `describe-change` reports `new-models-below-floor: 0`. This one is here because the other
#      three do not cover the case at all: a record with NO evidence behind it passes `check:data`,
#      `check:models` and `check:prices`, all three, exit 0. Measured, not assumed.
#
# Anything else leaves the branch open as a pull request. The PR is the record either way.
#
# The write path was verified before this shipped, by forcing the floor down until a real candidate
# cleared it: the record and its aliases were written, the contract went green, and condition 4
# correctly refused the merge. That test also caught a real bug — the first version scanned only
# observation batches, so it wrote `Muse Spark 1.2 (xhigh)` and left `muse-spark-1.2 (xHigh)`
# unmapped, which `check:models` fails on because alias resolution is exact. The attribution gate
# learned the same lesson on its own first run.
#
#   scripts/add-model-and-merge.sh

set -euo pipefail

BRANCH="auto/new-model"

node --experimental-strip-types scripts/propose-model.mjs > models.md || true
if ! grep -q "^[0-9]* qualify:" models.md; then
  echo "No upstream model clears the floor today. That is the expected steady state."
  exit 0
fi
count="$(sed -n 's/^\([0-9]*\) qualify:.*/\1/p' models.md | head -1)"

# Same signal as the attribution gate, same reason: an open pull request on this branch is this
# gate having already decided it cannot decide, and force-pushing over it would move the decision
# while somebody is making it.
open_pr="$(bash "$(dirname "$0")/pr-hands-off.sh" "$BRANCH" --any-open)"
if [ -n "$open_pr" ]; then
  echo "::warning::PR #$open_pr is waiting on a person; not overwriting it."
  echo "merged=no" >> "${GITHUB_OUTPUT:-/dev/null}"
  exit 0
fi

node --experimental-strip-types scripts/propose-model.mjs --write > /dev/null
npm run --silent ingest > /dev/null

node scripts/describe-change.mjs > change.md || echo "(could not describe the change)" > change.md
moved="$(sed -n 's/.*<!-- changed-cells: [0-9]* models, \([0-9]*\) moved -->.*/\1/p' change.md)"
below="$(sed -n 's/.*<!-- new-models-below-floor: \([0-9]*\) -->.*/\1/p' change.md)"

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

# An exemption is exactly the judgement a human owes. This gate may not write one either.
if git diff data/model-aliases.json | grep -qE '^\+.*"(acknowledgedDisagreements|mergedInOneSource)"'; then
  echo "An exemption was written to make this pass — that is a human's call."
  green=no
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -B "$BRANCH"
git add app/model-data.ts data/model-aliases.json app/observations.generated.ts
git commit -m "Add $count catalog record(s) for upstream model(s) that cleared the floor

$(sed '/^<!--/d' change.md)

Written by scripts/propose-model.mjs. A record is proposed only for a text model a
watched provider published in the last 60 days, absent from the catalog, carrying
more archived cells than the board averages. The aliases are the strings those
cells were counted on — one rule, not two.
"
git push --force origin "$BRANCH"

body="$(sed '/^<!--/d' change.md)

## Why these models

$(sed '/^<!--/d' models.md)

## Checks

\`\`\`text
$(cat checks.txt)
\`\`\`
"
printf '%s' "$body" | node scripts/gh-body.mjs pr-body.md

gh pr create --base main --head "$BRANCH" --title "Add $count catalog record(s) from upstream" --body-file pr-body.md \
  || gh pr edit "$BRANCH" --title "Add $count catalog record(s) from upstream" --body-file pr-body.md

if [ "$green" = "yes" ] && [ "${moved:-1}" = "0" ] && [ "${below:-1}" = "0" ]; then
  gh pr merge "$BRANCH" --merge --delete-branch
  echo "merged=yes" >> "${GITHUB_OUTPUT:-/dev/null}"
else
  echo "Left open for review: green=$green moved=${moved:-unknown} below-floor=${below:-unknown}"
  echo "merged=no" >> "${GITHUB_OUTPUT:-/dev/null}"
fi
