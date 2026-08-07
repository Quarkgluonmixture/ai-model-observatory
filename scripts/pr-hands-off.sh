#!/usr/bin/env bash
# Must this automated branch be left alone today? Prints the pull-request number if so, nothing
# otherwise. Always exits 0 — an unanswerable question (no `gh`, no network, no permission) must
# not fail a caller whose real work already succeeded, and "cannot tell" means "carry on".
#
#   scripts/pr-hands-off.sh auto/refresh-aa              # engagement-based
#   scripts/pr-hands-off.sh auto/attribution --any-open  # an open pull request is itself the signal
#
# ## The problem
#
# `auto/attribution` and `auto/refresh-aa` are both force-pushed daily and their pull-request
# bodies rewritten in place. That is right while nobody is looking: one pull request that always
# reflects today's state beats a queue of stale ones. It stops being right the moment a person
# starts deciding, and 2026-08-07 produced one example of each shape.
#
#   - PR #48 carried an AA re-read plus a hand-written reconciliation of the four catalog values it
#     disagreed with. The reconciliation was a *commit on the branch*. A force-push would have
#     deleted it, and the refresh that replaced it would have disagreed all over again.
#   - PR #45 asked whether Claude Opus 4.8's and GPT-5.5's arc-agi-2 cells should change hands.
#     Nobody had commented on it yet — they were still thinking — so no engagement signal existed
#     to protect it, and the next morning's run would have replaced its contents underneath the
#     owner.
#
# ## Two different signals, because the two branches mean different things
#
# **`--any-open` (attribution).** The gate merges and deletes its own branch the moment the
# contract is green and no published number moved. So an open pull request on that branch is not
# "a change awaiting review" — it is the gate having *already decided it cannot decide*. A person
# owes a judgement, and that is true whether or not they have typed anything yet. Waiting to see a
# comment means protecting the decision only after the owner has started defending it.
#
# The cost is real and is the point: while that pull request is open, new proposals queue behind it
# instead of merging. A queue that is visibly stuck is the correct failure mode for a system whose
# whole premise is that a wrong attribution costs more than a late one — and the unblock is one
# merge or one close.
#
# **Default (AA).** An open AA pull request *is* a normal reviewable snapshot: AA re-measures
# continuously, so replacing yesterday's numbers with today's is the branch working as designed.
# Only a person's own work on it — a comment, a review, or a commit that is not this bot's — is a
# reason to stop. Freezing this branch on "open" alone would freeze it permanently, since AA always
# has something new to say.

set -uo pipefail

BRANCH="${1:?branch name required}"
MODE="${2:-}"
BOT="github-actions[bot]"

number="$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty' 2>/dev/null || true)"
[ -n "$number" ] || exit 0

if [ "$MODE" = "--any-open" ]; then
  echo "$number"
  exit 0
fi

# `commits` covers the case no amount of waiting for a comment would: a reviewer who answered the
# pull request's question by writing the fix onto the branch rather than by typing.
engaged="$(gh pr view "$number" --json reviews,comments,commits \
  --jq "[ (.reviews[]?, .comments[]?) | select(.author.login != \"$BOT\") ]
         + [ .commits[]? | select(any(.authors[]?; .login != \"$BOT\" and .name != \"$BOT\")) ]
         | length" 2>/dev/null || echo 0)"

[ "${engaged:-0}" != "0" ] && echo "$number"
exit 0
