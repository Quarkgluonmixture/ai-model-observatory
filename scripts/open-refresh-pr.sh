#!/usr/bin/env bash
# Opens or updates the pull request that carries an automatic source refresh.
#
# One branch, force-pushed, so a board that moves three weeks running updates one pull request
# instead of opening three. Same reasoning as the collection-gaps issue: a queue of stale
# automated artefacts is indistinguishable from no automation at all.
#
# The checks are run here rather than left to CI on purpose. A pull request opened with
# GITHUB_TOKEN does not trigger workflows — GitHub blocks that to stop recursive runs — so
# without this the PR would arrive with no verdict attached. The result goes in the body.
#
#   scripts/open-refresh-pr.sh <checks-output-file>

set -euo pipefail

CHECKS="${1:?checks output file required}"
BRANCH="auto/refresh-sources"
TITLE="Refresh scripted sources"

# Describe the change before committing it: this compares the working tree against HEAD, so it
# has to run while the change is still uncommitted. It goes at the top of the pull request body,
# where a reviewer who cannot check an alias mapping can still check a score.
node scripts/describe-change.mjs > change.md || echo "(could not describe the change)" > change.md

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git checkout -B "$BRANCH"
git add data/sources app/observations.generated.ts
git commit -m "Refresh the scripted sources

Re-read every live board and re-ingested. Written by
.github/workflows/upstream.yml; the diff is whatever moved upstream.
"
git push --force origin "$BRANCH"

body="$(sed '/^<!--/d' change.md)

A scheduled re-read of the scripted sources found new data. Only boards that publish their own
data file are touched here, and only when a value actually moved — an unchanged source writes
nothing, so this pull request exists because something changed.

Review the diff as evidence, not as a formality: a board can restate a number for reasons the
fetcher cannot see.

\`\`\`
$(cat "$CHECKS")
\`\`\`

Checks ran inside the workflow because a pull request opened with \`GITHUB_TOKEN\` does not
trigger CI. Push any commit to this branch to get a real CI run."

existing="$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty')"
if [ -n "$existing" ]; then
  gh pr edit "$existing" --title "$TITLE" --body "$body" >/dev/null
  echo "Updated PR #$existing"
# See scripts/open-aa-pr.sh: a repository can forbid Actions from opening pull requests, and this
# path had never run — every refresh so far was tier A and went straight to main — so the one
# branch that exists specifically to be reviewed by a human was the one that would have failed.
elif gh pr create --head "$BRANCH" --title "$TITLE" --body "$body" 2>pr-error.txt; then
  :
else
  echo "::warning::Could not open the pull request ($(tr '\n' ' ' < pr-error.txt)); the branch is pushed. Open it at ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/compare/$BRANCH?expand=1"
fi
