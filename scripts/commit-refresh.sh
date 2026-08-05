#!/usr/bin/env bash
# Commits a tier-A refresh straight to main.
#
# Tier A is "numbers moved inside a mapping a human already reviewed": a live board published new
# results and the fetcher that reads it was vetted when it was written. There is no interpretation
# left to make, the seven checks validate the result, and git history keeps every value reviewable
# after the fact — so this is the one path allowed to reach production unattended. It is what makes
# the dashboard update itself.
#
# The caller must have established BOTH preconditions first: the change touches only the tier-A
# footprint, and the full contract passed. This script re-checks the footprint anyway, because it
# is the last gate before a public site changes and the cost of being wrong here is a wrong number
# published under this project's name.
#
#   scripts/commit-refresh.sh <fetch-log>

set -euo pipefail

LOG="${1:?fetch log required}"

# Belt and braces: never commit anything outside the tier-A footprint from here, whatever the
# caller believed. app/model-data.ts and data/model-aliases.json carry judgement, not measurements.
if git diff --name-only | grep -qvE '^(data/sources/|app/observations\.generated\.ts$|data/release-pages\.snapshot\.json$)'; then
  echo "Refusing to auto-commit: the change reaches outside data/sources and the generated store." >&2
  git diff --name-only >&2
  exit 1
fi

# What this does to the published board, in the board's own language. Written to change.md so the
# workflow can push the same sentences to WeChat that go into the commit message: "Qwen3.8 Max
# gained 12 cells" is something a person can sanity-check; "batch-19-gdpval.jsonl | 175 +++" is not.
node scripts/describe-change.mjs > change.md || echo "(could not describe the change)" > change.md

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add data/sources app/observations.generated.ts data/release-pages.snapshot.json
git commit -F - <<EOF
Refresh live boards

$(sed '/^<!--/d' change.md)

$(cat "$LOG")

Tier A: values moved inside existing mappings. The full contract passed in
.github/workflows/upstream.yml before this was committed. A change reaching
app/model-data.ts or data/model-aliases.json introduces a new mapping and
opens a pull request instead — see docs/AGENT-OPERATIONS.md.
EOF

git push origin HEAD:main
echo "Committed to main; EdgeOne will rebuild."
