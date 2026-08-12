// One-off: re-apply corrected parsing to AA rows already in the archive.
//
// Fixing a fetcher fixes every FUTURE read, but batch 14 and batch 26 are on-demand sources —
// neither is in the daily refresh, both need `AA_API_KEY`, and until one is re-run by hand the
// archive keeps the bad parse. So this re-derives the affected fields for the rows already
// captured.
//
// It is a re-parse, not an edit. Both rules recompute a field from evidence the row already
// carries verbatim, and both REFUSE to write unless the reconstruction matches that evidence —
// which is what separates re-reading the archive from rewriting it. Nothing else is touched.
//
//   1. PRODUCT TIER (`scripts/lib/product-tiers.mjs`). AA writes Alibaba's Max tier where it
//      writes reasoning effort, so `qwen3-8-max` was split into model `qwen3-8` + effort `max`
//      and resolved to nothing. `source_url` carries the slug verbatim, so the corrected
//      `model_raw` must rejoin to it byte for byte.
//
//   2. OPERATING POINT IN THE DISPLAY NAME. 135 of batch 14's rows have a bare slug and put the
//      operating point only in the name — slug `glm-5-2`, name "GLM-5.2 (max)". The fetcher read
//      the slug alone and filed them effort-null, which is the bucket a catalog record's DEFAULT
//      configuration is audited against. `note` preserves the display name (`AA 名称 …`), so the
//      effort is recoverable; the guard is that the name must actually parse to an operating
//      point, and a row whose effort is already set is never overwritten.
//
// Idempotent: rule 1's rows no longer end in a splittable token, rule 2's no longer have a null
// effort. Verification is not this script's word — it is the next real `npm run fetch:sources aa`
// / `aa-evals`, which must produce no diff on these rows. Delete this file once both batches have
// been re-fetched that way.
//
//   node scripts/backfill-aa-reparse.mjs [--write]

import { readFileSync, writeFileSync } from "node:fs";
import { isProductTier } from "./lib/product-tiers.mjs";

const BATCHES = [
  { file: "data/sources/batch-14-aa-parameters.jsonl", effortField: "effort", fromName: true },
  { file: "data/sources/batch-26-aa-evaluations.jsonl", effortField: "reasoning_effort", fromName: false },
];

const SLUG_PREFIX = "https://artificialanalysis.ai/models/";
const write = process.argv.includes("--write");

// Kept in step with `scripts/fetchers/artificial-analysis.mjs` — see its header for why both a
// MODE and a LEVEL are kept when AA prints both.
const LEVELS = ["minimal", "medium", "xhigh", "high", "low", "max"];
const MODES = ["non-reasoning", "reasoning"];
const displayName = (note) => /AA 名称 ([^；]+)/.exec(note ?? "")?.[1]?.trim() ?? null;
const effortFromName = (name) => {
  const match = /\(([^)]+)\)\s*$/.exec(name ?? "");
  if (!match) return null;
  const parts = match[1].split(",").map((part) => part.trim().toLowerCase().replace(/\s*effort\s*$/, ""));
  const level = parts.find((part) => LEVELS.includes(part)) ?? null;
  const mode = parts.find((part) => MODES.includes(part)) ?? null;
  if (level && mode) return `${mode} ${level}`;
  return level ?? mode;
};

let split = 0;
let named = 0;
let refused = 0;

for (const { file, effortField, fromName } of BATCHES) {
  const rows = readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  let touchedSplit = 0;
  let touchedName = 0;

  for (const row of rows) {
    const effort = row[effortField];

    // Rule 1 — product tier back into the slug.
    if (effort && isProductTier(row.model_raw ?? "", effort)) {
      const rejoined = `${row.model_raw}-${effort}`;
      const published = (row.source_url ?? "").startsWith(SLUG_PREFIX)
        ? row.source_url.slice(SLUG_PREFIX.length)
        : null;
      if (published !== rejoined) {
        console.error(`REFUSED ${file}: ${row.model_raw} + ${effort} != slug ${published ?? "(no model URL)"}`);
        refused += 1;
        continue;
      }
      row.model_raw = rejoined;
      row[effortField] = null;
      touchedSplit += 1;
      continue;
    }

    // Rule 2 — operating point out of the display name. Never overwrites an effort the slug or
    // the source already stated; only fills a null one.
    if (!fromName || effort != null) continue;
    const recovered = effortFromName(displayName(row.note));
    if (!recovered) continue;
    row[effortField] = recovered;
    touchedName += 1;
  }

  split += touchedSplit;
  named += touchedName;
  console.log(`${file}: ${touchedSplit} re-split, ${touchedName} effort recovered from the display name`);
  if (write && (touchedSplit || touchedName)) {
    writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  }
}

console.log(
  write
    ? `Wrote ${split + named} row(s).`
    : `Dry run — ${split} re-split + ${named} effort-recovered would change. Pass --write.`,
);
if (refused) {
  console.error(`${refused} row(s) refused: the archive is the evidence, and these did not reconstruct.`);
  process.exit(1);
}
