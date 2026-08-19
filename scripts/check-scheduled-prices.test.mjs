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
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MODELS } from "../app/model-data.ts";

const SOURCE_DIR = "data/sources";
const DAY = 24 * 60 * 60 * 1000;
const iso = (date) => date.toISOString().slice(0, 10);

const contract = (asOf, sourceDir) => {
  const args = ["--experimental-strip-types", "scripts/check-price-terms.mjs", "--as-of", asOf];
  if (sourceDir) args.push("--source-dir", sourceDir);
  try {
    run(process.execPath, args, { stdio: "pipe" });
    return { code: 0 };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
};

// One synthetic term against a real catalog record, so the two assertions below always have
// something to fire on. Written because on 2026-08-19 both real terms retired in the same change and
// the vacuity guard went red — correctly: it is there to stop this file reporting green while
// asserting nothing. A skip would have been the wrong answer for the same reason. `listPrice` is read
// from the catalog rather than typed, so the day-before case is green because the catalog really does
// quote list price today, not because a number was chosen to make it green.
const probe = MODELS[0];
const FIXTURE_FROM = "2026-01-15";
const fixtureDir = mkdtempSync(join(tmpdir(), "price-terms-"));
writeFileSync(join(fixtureDir, "fixture.meta.json"), JSON.stringify({
  batch: "synthetic · scripts/check-scheduled-prices.test.mjs",
  priceTerms: [{
    modelId: probe.id,
    retrievedOn: FIXTURE_FROM,
    listPrice: { input: probe.configurations[0].price.input, output: probe.configurations[0].price.output },
    scheduled: { input: probe.configurations[0].price.input * 3 + 1, output: probe.configurations[0].price.output * 3 + 1, effectiveFrom: FIXTURE_FROM },
    source: "https://example.invalid/synthetic",
  }],
}));
const syntheticTerm = { file: `${fixtureDir}/fixture.meta.json`, term: { modelId: probe.id, scheduled: { effectiveFrom: FIXTURE_FROM } }, dir: fixtureDir };

const scheduledTerms = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith(".meta.json"))
  .flatMap((file) => (JSON.parse(readFileSync(`${SOURCE_DIR}/${file}`, "utf8")).priceTerms ?? []).map((term) => ({ file, term })))
  .filter(({ term }) => term.scheduled);

// The synthetic term is always in this list, so neither assertion can pass vacuously; real terms
// join it whenever any are live.
const cases = [syntheticTerm, ...scheduledTerms];
if (!scheduledTerms.length) {
  console.log("note  no live scheduled price terms — the two assertions below run on the synthetic one only");
}

test("every scheduled price term is quiet the day before it applies", () => {
  assert.ok(cases.length > 0, "not even the synthetic term was built — this test would pass vacuously");
  for (const { file, term, dir } of cases) {
    const dayBefore = iso(new Date(new Date(term.scheduled.effectiveFrom) - DAY));
    assert.equal(contract(dayBefore, dir).code, 0, `${file} · ${term.modelId}: contract is already red on ${dayBefore}, before the change applies`);
  }
});

test("every scheduled price term fails the contract on the day it applies", () => {
  for (const { file, term, dir } of cases) {
    const { code, out } = contract(term.scheduled.effectiveFrom, dir);
    assert.equal(code, 1, `${file} · ${term.modelId}: contract still passes on ${term.scheduled.effectiveFrom}, so nothing will notice the price change`);
    assert.match(out ?? "", new RegExp(term.modelId), `${file} · ${term.modelId}: contract failed but did not name the model that changed`);
  }
});

test("the contract is green today, so the guard is not already overdue", () => {
  execFileSync(process.execPath, ["--experimental-strip-types", "scripts/check-price-terms.mjs"], { stdio: "pipe" });
});
