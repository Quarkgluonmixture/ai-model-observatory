// Did this change write an exemption to make itself pass?
//
//   node scripts/check-exemptions-untouched.mjs origin/main    # exit 1 if any hatch grew
//   node scripts/check-exemptions-untouched.mjs --self-test
//
// The alias config has escape hatches that only take effect with a written reason:
// `acknowledgedDisagreements` (two sources really do measure different things),
// `mergedInOneSource` (two published strings really are one model) and `withdrawnRows` (the source
// itself withdrew a row it had published). Each one is a judgement a person owes, so an unattended
// merge must never carry one — that is the third of tier B's three conditions in
// `docs/AGENT-OPERATIONS.md`.
//
// ## Why this is a script and not a grep
//
// Both auto-merge scripts asked `git diff data/model-aliases.json | grep '^+.*"mergedInOneSource"'`.
// That matches the line that NAMES the key, which appears exactly once in the file's life: the day
// the key is introduced. Appending an entry to a key that already exists never touches that line,
// so the guard stopped being able to fire the moment each key first landed — and all three keys are
// in the config today. Measured 2026-08-15 by appending a real `withdrawnRows` entry and running
// the grep: it printed nothing and the gate would have merged.
//
// A gate that cannot fire is the shape this repository keeps finding: a number no check can reach
// is not a checked number. So the question is asked of the parsed config instead — how many entries
// does each hatch hold, before and after — which is the thing the rule is actually about.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const HATCHES = ["acknowledgedDisagreements", "mergedInOneSource", "withdrawnRows"];
const FILE = "data/model-aliases.json";

/** Entry counts per hatch. A missing key is 0, not an error: a config may predate a hatch. */
export const countHatches = (config) =>
  Object.fromEntries(HATCHES.map((key) => [key, (config?.[key] ?? []).length]));

/**
 * Which hatches grew. Only growth counts — removing an exemption is a person retiring a judgement,
 * and it cannot make a failing contract pass.
 */
export const grown = (before, after) =>
  HATCHES.filter((key) => (after[key] ?? 0) > (before[key] ?? 0))
    .map((key) => ({ key, before: before[key] ?? 0, after: after[key] ?? 0 }));

if (process.argv.includes("--self-test")) {
  let failed = 0;
  const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "ok   " : "FAIL "} ${label}${ok ? "" : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
    if (!ok) failed = 1;
  };
  const c = (n) => ({ acknowledgedDisagreements: n, mergedInOneSource: n, withdrawnRows: n });

  check("no change is no growth", grown(c(2), c(2)), []);
  // The case the old grep missed, and the whole reason this file exists.
  check("appending to an EXISTING hatch is caught",
    grown({ ...c(2), withdrawnRows: 1 }, { ...c(2), withdrawnRows: 2 }),
    [{ key: "withdrawnRows", before: 1, after: 2 }]);
  check("introducing a hatch that was absent is caught",
    grown({ acknowledgedDisagreements: 0 }, { acknowledgedDisagreements: 1 }),
    [{ key: "acknowledgedDisagreements", before: 0, after: 1 }]);
  check("removing an exemption is not growth", grown(c(3), c(2)), []);
  check("a missing key counts as zero, not a crash", countHatches({}), c(0));
  check("all three hatches are watched", HATCHES.length, 3);
  // Every hatch in the real config must be named here, or the gate is silently partial again.
  const live = JSON.parse(readFileSync(FILE, "utf8"));
  const unwatched = Object.keys(live).filter(
    (k) => Array.isArray(live[k]) && /disagree|merged|withdrawn|exempt/i.test(k) && !HATCHES.includes(k),
  );
  check("no hatch-shaped key in the live config is unwatched", unwatched, []);

  console.log(failed ? "self-test FAILED" : "self-test passed");
  process.exit(failed);
}

const base = process.argv[2];
if (!base) throw new Error("usage: check-exemptions-untouched.mjs <git-ref>");

const before = countHatches(JSON.parse(execFileSync("git", ["show", `${base}:${FILE}`], { encoding: "utf8" })));
const after = countHatches(JSON.parse(readFileSync(FILE, "utf8")));
const added = grown(before, after);

if (added.length === 0) {
  console.log(`No exemption was added (${HATCHES.map((k) => `${k} ${after[k]}`).join(", ")}).`);
  process.exit(0);
}
for (const { key, before: b, after: a } of added) {
  console.error(`${key} grew ${b} -> ${a} — an exemption was written to make this pass, which is a human's call.`);
}
process.exit(1);
