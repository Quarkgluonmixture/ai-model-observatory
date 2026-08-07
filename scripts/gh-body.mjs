// Writes a body that is safe to hand to `gh --body-file`. Reads the body on stdin.
//
//   printf '%s' "$body" | node scripts/gh-body.mjs pr-body.md
//   gh pr create --body-file pr-body.md …
//
// This exists because `gh pr create --body "$body"` has two ceilings and neither of them is
// gh's. On 2026-08-07 the Artificial Analysis refresh hit the first one:
//
//   scripts/open-aa-pr.sh: line 74: /usr/bin/gh: Argument list too long
//
// The body was 200,061 bytes, and Linux caps a *single* argv entry at 128 KiB
// (MAX_ARG_STRLEN, 32 pages) regardless of how much total argument space the system allows. So
// execve failed and gh never started — the error came from bash. The branch was already pushed
// and the fallback notification was correct, but the pull request did not exist.
//
// Passing --body-file clears that ceiling and lands straight on the second one: GitHub caps an
// issue or pull-request body at 65,536 characters and answers a longer one with a 422. A fix that
// only changed the flag would have moved the failure four weeks down the road, into a different
// error message, with the same outcome.
//
// So both are handled here, in one place, for every caller. The truncation says how much it cut
// and where the rest is, because this project has already learned what an artefact that is quietly
// incomplete costs: a notification that is wrong about its own outcome spends the one thing the
// channel runs on, which is being believed. A truncated report that does not say so is the same
// mistake in a different medium.

import { writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/gh-body.mjs <outfile>   (body on stdin)");
  process.exit(2);
}

// GitHub's own limit is 65,536 *characters*, not bytes, so the count below is in code units and
// the margin covers the notice this appends plus anything a caller adds after us.
const LIMIT = 60000;

const body = await new Promise((resolve) => {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { buffer += chunk; });
  process.stdin.on("end", () => resolve(buffer));
});

let out = body;
if (body.length > LIMIT) {
  const runUrl = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY ?? ""}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;
  // Cut on a line boundary. A body that stops mid-sentence inside a fenced code block renders as
  // an unterminated fence and swallows everything after it in the GitHub view.
  const cut = out.slice(0, LIMIT).replace(/\n[^\n]*$/, "");
  const fenced = (cut.match(/^```/gm) ?? []).length % 2 === 1;
  out = [
    cut,
    ...(fenced ? ["```"] : []),
    "",
    "---",
    "",
    `_**Truncated.** ${body.length - cut.length} more character(s) were cut to stay under GitHub's ` +
      `65,536-character body limit. ${runUrl ? `The whole report is in [this run](${runUrl}).` : "The whole report is in the workflow run that produced it."}_`,
    "",
  ].join("\n");
}

writeFileSync(target, out);
console.log(
  body.length > LIMIT
    ? `Wrote ${target}: truncated ${body.length} chars to ${out.length}.`
    : `Wrote ${target}: ${out.length} chars.`,
);
