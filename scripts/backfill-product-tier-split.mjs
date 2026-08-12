// One-off: re-apply the corrected effort split to rows already in the archive.
//
// `scripts/lib/product-tiers.mjs` explains what was wrong. Fixing the two AA fetchers fixes every
// FUTURE read, but batch 14 and batch 26 are on-demand sources — neither is in the daily refresh,
// both need `AA_API_KEY`, and until one is re-run by hand the archive keeps the bad split and the
// ten rows stay invisible. So this re-derives those two fields for the rows already captured.
//
// It is a re-parse, not an edit. The archive preserves what AA published, and `source_url` carries
// the slug verbatim (`https://artificialanalysis.ai/models/qwen3-8-max`), so the corrected
// `model_raw` is recoverable from the row itself. This script recomputes it and REFUSES to write
// unless the reconstruction is byte-identical to that slug — which is what separates re-reading
// evidence from rewriting it. Nothing else on the row is touched.
//
// Idempotent: a row already carrying the full slug no longer ends in a splittable token, so a
// second run reports zero changes. Verification that it agrees with the fetchers is not this
// script's word — it is the next real `npm run fetch:sources aa` / `aa-evals`, which must produce
// no diff on these rows. Delete this file once both batches have been re-fetched that way.
//
//   node scripts/backfill-product-tier-split.mjs [--write]

import { readFileSync, writeFileSync } from "node:fs";
import { isProductTier } from "./lib/product-tiers.mjs";

const BATCHES = [
  { file: "data/sources/batch-14-aa-parameters.jsonl", effortField: "effort" },
  { file: "data/sources/batch-26-aa-evaluations.jsonl", effortField: "reasoning_effort" },
];

const SLUG_PREFIX = "https://artificialanalysis.ai/models/";
const write = process.argv.includes("--write");

let changed = 0;
let refused = 0;

for (const { file, effortField } of BATCHES) {
  const lines = readFileSync(file, "utf8").trim().split("\n");
  const rows = lines.map((line) => JSON.parse(line));
  let touched = 0;

  for (const row of rows) {
    const effort = row[effortField];
    if (!effort || !isProductTier(row.model_raw ?? "", effort)) continue;

    const rejoined = `${row.model_raw}-${effort}`;
    const published = (row.source_url ?? "").startsWith(SLUG_PREFIX)
      ? row.source_url.slice(SLUG_PREFIX.length)
      : null;

    // The guard, and the whole reason this is allowed to touch the archive: if the two halves do
    // not put the published slug back together, this row was not produced by the split being
    // corrected and must be left exactly as captured.
    if (published !== rejoined) {
      console.error(`REFUSED ${file}: ${row.model_raw} + ${effort} != slug ${published ?? "(no model URL)"}`);
      refused += 1;
      continue;
    }

    row.model_raw = rejoined;
    row[effortField] = null;
    touched += 1;
  }

  changed += touched;
  console.log(`${file}: ${touched} row(s) re-split`);
  if (write && touched) writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

console.log(write ? `Wrote ${changed} row(s).` : `Dry run — ${changed} row(s) would change. Pass --write.`);
if (refused) {
  console.error(`${refused} row(s) refused: the archive is the evidence, and these did not reconstruct.`);
  process.exit(1);
}
