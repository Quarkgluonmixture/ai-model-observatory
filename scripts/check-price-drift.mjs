// Reports when a hand-copied list price may have gone stale.
//
//   node --experimental-strip-types scripts/check-price-drift.mjs
//   node --experimental-strip-types scripts/check-price-drift.mjs --self-test
//
// ## The gap this fills
//
// Every observation in this catalog is re-read by script and diffed against its archive every
// morning. Prices are not: `ingest.mjs` reads Elo out of the parameter batches and nothing else, so
// a list price is typed into `app/model-data.ts` by hand from a vendor page and then audited only
// against the batch it was typed from. Both sides of that comparison are the same hand-copied
// snapshot, so a vendor raising its price leaves every check green — measured 2026-08-14, the whole
// contract passes with three catalog prices that no longer match what Artificial Analysis reads.
//
// ## Why AA, and why this reports instead of failing
//
// AA is the only source in the archive that re-reads pricing for every maker on a schedule, which
// makes it the cheapest possible drift probe: one fetcher covers all 29 records. It is NOT the
// authority and this file must never be read as saying it is. Two reasons, both already settled in
// `docs/ARCHITECTURE.md` §5 and `AGENTS.md`:
//
//   - A price is a term of sale, not a measurement. The vendor's own page is what the catalog
//     quotes, and `check:prices` already guards the one way that goes wrong (quoting a promotion).
//   - AA flattens a tier structure into one number. A model sold at several tiers can legitimately
//     differ from AA's single figure without anybody being wrong.
//
// So a difference here is a prompt to re-open the vendor page, not a verdict that the catalog is
// wrong — which is exactly why it exits 0 and lands in the collection-gaps issue rather than
// failing the daily job. A probe that cries wolf about a tier structure would be switched off
// within a week, and then the real price change would go unreported too.
//
// ## The threshold is deliberately loose to start
//
// 10%. Set wide on purpose for its first week: the failure mode that matters is a probe nobody
// reads, and a vendor price change is double-digit far more often than it is 3%. Measured against
// today's archive it names three models; tighten it once there is a week of evidence about what it
// says on ordinary days.

import { readdirSync, readFileSync } from "node:fs";
import { buildResolvers, loadAliasConfig, readArchiveFiles } from "./lib/archive.mjs";
import { FETCHERS } from "./fetchers/index.mjs";

const SOURCE_DIR = "data/sources";
export const DRIFT_THRESHOLD = 0.1;

/**
 * Compares one catalog price against every price AA published for that model.
 *
 * `aaPrices` is a list because AA publishes a row per operating point and they do not always agree;
 * a catalog price matching ANY of them is not drift. Returns null when there is nothing to compare,
 * which the caller counts separately — "AA has no price for this model" is a different fact from
 * "the prices agree", and collapsing them would let coverage rot silently.
 *
 * Exported for `--self-test`, which is the only reason it is a function rather than a loop body:
 * the arithmetic is the part that decides whether a number reaches a person.
 */
export const driftBetween = (catalogPrice, aaPrices, threshold = DRIFT_THRESHOLD) => {
  if (!catalogPrice) return null;
  const usable = (aaPrices ?? []).filter((price) => price.input != null || price.output != null);
  if (usable.length === 0) return null;

  const off = (mine, theirs) => {
    if (mine == null || theirs == null) return null;
    if (theirs === 0) return mine === 0 ? 0 : Infinity;
    return (mine - theirs) / theirs;
  };
  // Agreement on both axes against the SAME AA row. Checking the axes independently would let a
  // model match one row's input and another row's output and be called agreeing, which is how a
  // per-tier price structure hides a real move.
  const agrees = usable.some((price) => {
    const dIn = off(catalogPrice.input, price.input);
    const dOut = off(catalogPrice.output, price.output);
    const within = (d) => d === null || Math.abs(d) <= threshold;
    return within(dIn) && within(dOut);
  });
  if (agrees) return null;

  // Report against the closest AA row, so the message names the smallest real gap rather than the
  // most alarming one.
  const scored = usable
    .map((price) => ({
      price,
      distance: Math.max(Math.abs(off(catalogPrice.input, price.input) ?? 0), Math.abs(off(catalogPrice.output, price.output) ?? 0)),
    }))
    .sort((a, b) => a.distance - b.distance);
  const closest = scored[0];
  return {
    aa: closest.price,
    inputDelta: off(catalogPrice.input, closest.price.input),
    outputDelta: off(catalogPrice.output, closest.price.output),
  };
};

/**
 * The AA parameter batch, found through the fetcher registry rather than by filename, so renaming a
 * batch surfaces here instead of silently zeroing the probe. Throws rather than returning empty:
 * a probe that reads nothing prints "no drift", which is indistinguishable from a healthy board and
 * is the single most expensive way for this file to be wrong.
 */
export const aaParameterBatch = (parameterBatches, fetchers = FETCHERS) => {
  const fetcher = fetchers.find((entry) => entry.id === "aa");
  if (!fetcher) throw new Error("no fetcher with id 'aa' — the AA parameter source was renamed; this probe reads nothing until it is pointed at the new one");
  const file = `${fetcher.batch}.jsonl`;
  const batch = parameterBatches.find((entry) => entry.file === file);
  if (!batch) throw new Error(`fetcher 'aa' names ${file}, which is not among the parameter batches`);
  const priced = batch.rows.filter(({ raw }) => raw.price_input_per_m != null || raw.price_output_per_m != null);
  if (priced.length === 0) throw new Error(`${file} carries no priced rows — AA stopped publishing prices, or the fetcher stopped recording them`);
  return { file, priced };
};

/**
 * Whether an already-declared promotion accounts for the difference, in which case it is not a
 * finding at all.
 *
 * The catalog quotes list price; AA quotes what a buyer pays today. So every model under a live
 * promotion disagrees with AA by exactly the discount, every day, for as long as the promotion
 * runs — and a permanent entry would bury the real ones within a week. Measured 2026-08-14:
 * `claude-sonnet-5` reads $3/$15 in the catalog and $2/$10 at AA, and $2/$10 is the promotional
 * price already archived in `batch-10-standard-pricing.meta.json` with a published end date.
 *
 * An EXPIRED promotion is the opposite finding and stays reported: AA still charging the
 * promotional rate past its published end date means the term is what has gone stale.
 *
 * `term.promotional` is optional because a batch meta may declare other shapes of term; anything
 * without a promotion and an end date explains nothing here and is left to the caller to report.
 */
export const explainedByTerm = (aaPrice, terms, today, threshold = DRIFT_THRESHOLD) =>
  (terms ?? []).find((term) => {
    const promo = term?.promotional;
    if (!promo || !promo.endsOn || promo.endsOn < today) return false;
    const close = (mine, theirs) =>
      mine != null && theirs != null && Math.abs(mine - theirs) <= Math.abs(theirs) * threshold;
    return close(aaPrice.input, promo.input) && close(aaPrice.output, promo.output);
  });

const pct = (delta) => (delta === null ? "—" : `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%`);
const money = (price) => `$${price.input ?? "—"}/$${price.output ?? "—"}`;

// ---------------------------------------------------------------- self-test
if (process.argv.includes("--self-test")) {
  let failed = 0;
  const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "ok   " : "FAIL "} ${label}${ok ? "" : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
    if (!ok) failed = 1;
  };
  const drifts = (catalog, aa) => driftBetween(catalog, aa) !== null;

  check("identical prices do not drift", drifts({ input: 3, output: 15 }, [{ input: 3, output: 15 }]), false);
  check("5% under the threshold does not drift", drifts({ input: 3.15, output: 15 }, [{ input: 3, output: 15 }]), false);
  check("25% over the threshold drifts", drifts({ input: 2.5, output: 15 }, [{ input: 2, output: 12 }]), true);
  // The case the per-axis version got wrong: two tiers, each agreeing on one axis only.
  check("matching two different rows on one axis each is still drift",
    drifts({ input: 3, output: 15 }, [{ input: 3, output: 30 }, { input: 9, output: 15 }]), true);
  check("agreeing with any single row is not drift",
    drifts({ input: 3, output: 15 }, [{ input: 9, output: 45 }, { input: 3, output: 15 }]), false);
  check("no AA price is not a comparison", driftBetween({ input: 3, output: 15 }, []), null);
  check("AA rows with null prices are not a comparison", driftBetween({ input: 3, output: 15 }, [{ input: null, output: null }]), null);
  check("no catalog price is not a comparison", driftBetween(null, [{ input: 3, output: 15 }]), null);

  // A zero on AA's side must not read as agreement through a divide-by-zero.
  check("a zero AA price against a non-zero catalog price drifts", drifts({ input: 3, output: 15 }, [{ input: 0, output: 0 }]), true);

  // And the direction that matters most: the probe must refuse to run rather than report "no drift"
  // when it is looking at nothing. Each of the three failure shapes is asserted separately because
  // they fail at different points and a single try/catch would pass on any one of them.
  const threw = (fn) => { try { fn(); return false; } catch { return true; } };
  check("a renamed AA fetcher throws instead of reporting silence",
    threw(() => aaParameterBatch([], [{ id: "not-aa", batch: "batch-14-aa-parameters" }])), true);
  check("a missing batch file throws",
    threw(() => aaParameterBatch([], [{ id: "aa", batch: "batch-14-aa-parameters" }])), true);
  check("a batch with no priced rows throws",
    threw(() => aaParameterBatch(
      [{ file: "batch-14-aa-parameters.jsonl", rows: [{ raw: { model_raw: "x", price_input_per_m: null, price_output_per_m: null } }] }],
      [{ id: "aa", batch: "batch-14-aa-parameters" }],
    )), true);

  // The suppression rule decides what is NOT reported, which is the half a reader cannot audit by
  // looking at the output. A live promotion must silence the difference and an expired one must not.
  const promo = (endsOn) => [{ file: "batch-10-standard-pricing.meta.json", promotional: { input: 2, output: 10, endsOn } }];
  const named = (found) => found?.file ?? null;
  check("a live promotion explains AA quoting the discounted price",
    named(explainedByTerm({ input: 2, output: 10 }, promo("2026-08-31"), "2026-08-14")), "batch-10-standard-pricing.meta.json");
  check("an expired promotion explains nothing — the term is the stale thing",
    named(explainedByTerm({ input: 2, output: 10 }, promo("2026-08-01"), "2026-08-14")), null);
  check("the promotion must actually match AA's price to explain it",
    named(explainedByTerm({ input: 0.2, output: 1.2 }, promo("2026-08-31"), "2026-08-14")), null);
  check("no term explains nothing", named(explainedByTerm({ input: 2, output: 10 }, [], "2026-08-14")), null);
  check("a term shape carrying no promotion is not a crash",
    named(explainedByTerm({ input: 2, output: 10 }, [{ file: "batch-31.meta.json", scheduled: {} }], "2026-08-14")), null);

  console.log(failed ? "self-test FAILED" : "self-test passed");
  process.exit(failed);
}

// ---------------------------------------------------------------- report
const { MODELS } = await import("../app/model-data.ts");
const { resolveModelId } = buildResolvers(loadAliasConfig());
const { parameterBatches } = readArchiveFiles();
const { file, priced } = aaParameterBatch(parameterBatches);

const aaByModel = new Map();
for (const { raw } of priced) {
  const id = resolveModelId(raw.model_raw, raw.effort ?? null, file.replace(/\.jsonl$/, ""));
  if (!id) continue;
  if (!aaByModel.has(id)) aaByModel.set(id, []);
  aaByModel.get(id).push({ input: raw.price_input_per_m, output: raw.price_output_per_m, label: raw.model_raw, effort: raw.effort ?? null });
}

// A price term already explains a difference — that is what it is for — so a model carrying one is
// named with its term rather than reported as an unexplained move. Read from the batch metas, the
// same place `check:prices` reads them, so the two checks cannot disagree about what is declared.
const termsByModel = new Map();
for (const name of readdirSync(SOURCE_DIR).filter((entry) => entry.endsWith(".meta.json"))) {
  const meta = JSON.parse(readFileSync(`${SOURCE_DIR}/${name}`, "utf8"));
  for (const term of meta.priceTerms ?? []) {
    if (!termsByModel.has(term.modelId)) termsByModel.set(term.modelId, []);
    termsByModel.get(term.modelId).push({ ...term, file: name });
  }
}

const today = new Date().toISOString().slice(0, 10);

const drifted = [];
const explained = [];
let compared = 0;
let unpriced = 0;
for (const model of MODELS) {
  const result = driftBetween(model.price, aaByModel.get(model.id));
  if (result === null) {
    if (aaByModel.get(model.id)?.length) compared += 1;
    else unpriced += 1;
    continue;
  }
  compared += 1;
  const terms = termsByModel.get(model.id) ?? [];
  const term = explainedByTerm(result.aa, terms, today);
  if (term) explained.push({ model, term });
  else drifted.push({ model, ...result, terms });
}

const lines = [];
lines.push("## Has a hand-copied price gone stale?");
lines.push("");
if (drifted.length === 0) {
  lines.push(
    `Every one of the ${compared} catalog list price(s) Artificial Analysis also publishes agrees with ` +
      `its latest reading to within ${Math.round(DRIFT_THRESHOLD * 100)}%. ` +
      (unpriced ? `${unpriced} catalog model(s) have no AA price to compare against.` : ""),
  );
} else {
  lines.push(
    `**${drifted.length} of ${compared}** catalog list prices differ from Artificial Analysis' latest ` +
      `reading by more than ${Math.round(DRIFT_THRESHOLD * 100)}%. AA is not the authority on price — ` +
      "the vendor's own page is, and AA flattens a tier structure into one number — so this is a " +
      "prompt to re-open that page, not a verdict that the catalog is wrong. " +
      "The catalog quotes list price (`check:prices` guards that); what nothing else can see is the " +
      "vendor moving it after the number was copied in by hand.",
  );
  lines.push("");
  for (const entry of drifted) {
    lines.push(
      `- \`${entry.model.id}\` — catalog ${money(entry.model.price)}, AA ${money(entry.aa)} ` +
        `(input ${pct(entry.inputDelta)}, output ${pct(entry.outputDelta)})` +
        (entry.aa.effort ? ` · AA row \`${entry.aa.label}\`` : ""),
    );
    for (const term of entry.terms) {
      lines.push(`  - a declared price term already covers this model: \`${term.file}\` — check it before re-reading the vendor page`);
    }
  }
  if (unpriced) {
    lines.push("");
    lines.push(`${unpriced} catalog model(s) have no AA price at all, so nothing here can speak for them.`);
  }
}

// Printed rather than filtered away, for the same reason `report:gaps` prints its pricing tiers and
// its image models: a silent exclusion is indistinguishable from a check that never looked.
if (explained.length) {
  lines.push("");
  lines.push(
    `${explained.length} further model(s) differ from AA by a discount that is already declared, which is ` +
      "the expected state and not a finding — AA quotes what a buyer pays today and the catalog quotes " +
      "list price: " +
      explained.map(({ model, term }) => `\`${model.id}\` (${term.file}, ends ${term.promotional.endsOn})`).join(", ") +
      ".",
  );
}

console.log(lines.join("\n"));
