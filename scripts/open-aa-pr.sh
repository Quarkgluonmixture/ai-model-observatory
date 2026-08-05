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

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git checkout -B "$BRANCH"
git add data/sources app/observations.generated.ts
git commit -m "Refresh the Artificial Analysis parameter batch

Re-read on request via .github/workflows/aa-refresh.yml. AA re-measures speed,
latency and cost continuously, so this is a snapshot, not a correction: the
catalog is only wrong where check:models says so.
"
git push --force origin "$BRANCH"

body="An on-demand re-read of Artificial Analysis. AA is not part of the daily refresh because it
re-measures continuously; this branch exists so that adding a model does not require a person with
the API key at a terminal.

**Read \`check:models\` below before merging.** A value it flags is not automatically a defect in
this diff — AA re-measuring speed is normal, and the question is whether the catalog number or the
archived one is the stale side. Batch 08 corrected 43 catalog values this way, two of which had
been quoted as evidence *against* the source.

\`\`\`
$(cat "$CHECKS")
\`\`\`

Checks ran inside the workflow because a pull request opened with \`GITHUB_TOKEN\` does not trigger
CI. Push any commit to this branch to get a real CI run."

existing="$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty')"
if [ -n "$existing" ]; then
  gh pr edit "$existing" --title "$TITLE" --body "$body" >/dev/null
  url="$(gh pr view "$existing" --json url --jq .url)"
  echo "Updated PR #$existing"
else
  url="$(gh pr create --head "$BRANCH" --title "$TITLE" --body "$body")"
  echo "$url"
fi

{
  echo "AA 参数已重读,PR 在等你看一眼。"
  echo
  echo "重点看 \`check:models\`:它报红不代表这次改动有问题 —— AA 持续重测,要判断的是目录和源哪边过期了。"
  echo
  echo "$url"
} | node "$DIR/notify-pushplus.mjs" "观测台 · AA 参数刷新 PR"
