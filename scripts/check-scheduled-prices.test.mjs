// A scheduled price term is a guard that fires on a date. Running it today proves only that it is
// quiet today, which is also what a term that never fires looks like — so both sides of every
// effective date are asserted here by re-running the real contract with `--as-of`.
//
//   node --test scripts/check-scheduled-prices.test.mjs
//
// Why a test file rather than a `--self-test` flag like the other guards: this one has to observe
// the contract's EXIT CODE, and that is exactly what a pipeline hides. The first run of this
// assertion reported green on both sides because `$?` after `node … | tail -5` is tail's status,
// not node's — the same trap `upstream.yml` calls load-bearing pipefail. Reading the status from a
// child process leaves nothing to get wrong.

import { strict as assert } from "node:assert";
import { execFileSync, execFileSync as run } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const SOURCE_DIR = "data/sources";
const DAY = 24 * 60 * 60 * 1000;
const iso = (date) => date.toISOString().slice(0, 10);

const contract = (asOf) => {
  try {
    run(process.execPath, ["--experimental-strip-types", "scripts/check-price-terms.mjs", "--as-of", asOf], { stdio: "pipe" });
    return { code: 0 };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
};

const scheduledTerms = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith(".meta.json"))
  .flatMap((file) => (JSON.parse(readFileSync(`${SOURCE_DIR}/${file}`, "utf8")).priceTerms ?? []).map((term) => ({ file, term })))
  .filter(({ term }) => term.scheduled);

test("every scheduled price term is quiet the day before it applies", () => {
  assert.ok(scheduledTerms.length > 0, "no scheduled price terms found — this test would pass vacuously");
  for (const { file, term } of scheduledTerms) {
    const dayBefore = iso(new Date(new Date(term.scheduled.effectiveFrom) - DAY));
    assert.equal(contract(dayBefore).code, 0, `${file} · ${term.modelId}: contract is already red on ${dayBefore}, before the change applies`);
  }
});

test("every scheduled price term fails the contract on the day it applies", () => {
  for (const { file, term } of scheduledTerms) {
    const { code, out } = contract(term.scheduled.effectiveFrom);
    assert.equal(code, 1, `${file} · ${term.modelId}: contract still passes on ${term.scheduled.effectiveFrom}, so nothing will notice the price change`);
    assert.match(out ?? "", new RegExp(term.modelId), `${file} · ${term.modelId}: contract failed but did not name the model that changed`);
  }
});

test("the contract is green today, so the guard is not already overdue", () => {
  execFileSync(process.execPath, ["--experimental-strip-types", "scripts/check-price-terms.mjs"], { stdio: "pipe" });
});
