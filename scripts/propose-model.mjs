// Which upstream model has earned a catalog record, and what that record would be.
//
//   node --experimental-strip-types scripts/propose-model.mjs            # report only
//   node --experimental-strip-types scripts/propose-model.mjs --write    # write the ones that qualify
//   node --experimental-strip-types scripts/propose-model.mjs --floor 5  # testing only, see below
//
// ## The four conditions, and why the fourth is the whole design
//
// A model qualifies only if all four hold. The first three are cheap and mechanical:
//
//   text        `architecture.output_modalities` is text only. Nano Banana Pro outputs images and
//               is not a candidate for a capability catalog. A field lookup, not a judgement.
//   real        a provider the catalog already resolves into is serving it. Being on the feed is
//               what "exists" means here.
//   not a dupe  no catalog record and no price lookup already claims it.
//
// The fourth is the one that took measuring. A catalog record with NO evidence behind it passes
// `check:data`, passes `check:models` with exit 0, and passes `check:prices` — all three contracts
// are green on a model whose row is empty across every column, because none of them asks whether a
// record has any rows. So the fourth condition is arithmetic: the model must already have enough
// archived rows to fill more cells than the models on the board average, or adding it lowers cell
// coverage, which `AGENTS.md` calls the only metric that matters. That floor is recomputed every
// run and is 38 today.
//
// ## The rule that admits a model is the rule that writes its aliases
//
// This is the part worth arguing with, so it is stated rather than buried. A record with no
// aliases is an empty row — it would fail its own fourth condition — so anything that writes a
// record unattended must write aliases unattended too. And aliases are exactly what
// `scripts/propose-attribution.mjs` refuses to write for strings like `openai-gpt-5-6-sol-max`,
// because a maker prefix leaves a residual token and a residual token is a model distinction until
// a reader says otherwise.
//
// The resolution is that there is only ONE rule here, not two. The strings this writes aliases for
// are precisely the strings whose cells were counted toward the floor: same normalisation, same
// version guard, same match. If that rule is trustworthy enough to admit the model, it is
// trustworthy enough to name the rows that admitted it; if it is not, the model should not be
// admitted. Splitting them — counting generously, mapping conservatively — would produce a record
// admitted on evidence it then cannot attach, which is an empty row arrived at by arithmetic.
//
// The rule's error profile is measured, not asserted:
// `node --experimental-strip-types scripts/lib/upstream-evidence.mjs --self-test` replays it
// against every catalog model. 92% mean recovery, and one known overstatement — one cell, on
// `deepseek-v4-flash`, caused by a slug that means two models — documented in that module.
//
// ## What it will not do
//
// It never invents a number. Colour is chosen from shades the maker is not already using; tags are
// left empty because they drive the filter chips and are editorial; open-weights stays `false` and
// unsourced, which `check:models` reports, because no source consulted states it either way.
// Everything numeric comes from the archived Artificial Analysis parameter rows or is null.
//
// `--floor` exists for one purpose: proving the write path works when no real candidate clears the
// real floor. It prints a warning and must never be used to lower the bar for an actual addition.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BENCHMARKS, MODELS, OBSERVATIONS_BY_CELL } from "../app/model-data.ts";
import { PROVIDER_LOOKUPS } from "../app/api/live-models/route.ts";
import { buildResolvers, loadAliasConfig, readArchiveFiles } from "./lib/archive.mjs";
import { buildEvidenceIndex, dilutionFloor, norm } from "./lib/upstream-evidence.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const argOf = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};
const write = args.includes("--write");
const floorOverride = argOf("floor") ? Number(argOf("floor")) : null;

const config = loadAliasConfig();
const { resolveModelId } = buildResolvers(config);
const lookupEvidence = buildEvidenceIndex(BENCHMARKS.map((benchmark) => benchmark.id));

const filled = MODELS.reduce((total, model) => total + Object.keys(OBSERVATIONS_BY_CELL[model.id] ?? {}).length, 0);
const realFloor = dilutionFloor(filled, MODELS.length);
const floor = floorOverride ?? realFloor;
if (floorOverride !== null) {
  console.log(`⚠ --floor ${floorOverride} overrides the measured floor of ${realFloor}. For testing the write path only.`);
}

// ---------------------------------------------------------------- upstream
const response = await fetch("https://openrouter.ai/api/v1/models", { headers: { Accept: "application/json" } });
if (!response.ok) throw new Error(`upstream ${response.status}`);
const list = (await response.json()).data ?? [];
if (list.length === 0) throw new Error("the feed returned no models");

const upstreamIds = new Set(list.map((item) => item.id.toLowerCase()));
const matched = Object.entries(PROVIDER_LOOKUPS).filter(([, id]) => upstreamIds.has(id)).map(([, id]) => id);
const namespaces = new Set(matched.map((id) => id.split("/")[0]));
const known = new Set(matched);
const catalogNeedles = [...Object.values(PROVIDER_LOOKUPS), ...MODELS.map((model) => model.id)];

const textOnly = (item) => {
  const out = item?.architecture?.output_modalities;
  return Array.isArray(out) && out.length > 0 && out.every((modality) => modality === "text");
};

// Recency, and it is a condition rather than a tidy-up. Without it "not in the catalog" quietly
// becomes "any model the catalog does not carry", and providers serve previous generations for a
// long time: the first run of this script proposed Claude Sonnet 4.6 and GPT-5.2, both deliberately
// absent, one of them with 36 cells of genuine archived evidence behind it. Evidence is not the
// question for a model whose generation has passed — the catalog's own `_doc` lists both as
// "previous generation, no catalog record". `report:gaps` has always applied this window; dropping
// it here was the bug.
const sinceDays = Number(argOf("since-days") ?? 60);
const cutoff = Date.now() / 1000 - sinceDays * 86400;

const candidates = list
  .filter((item) => namespaces.has(item.id.split("/")[0]))
  .filter((item) => !item.id.includes(":"))                                   // an operating point, not a model
  .filter((item) => !known.has(item.id))
  .filter((item) => !catalogNeedles.some((needle) => item.id.toLowerCase().includes(needle)))
  .filter((item) => Number(item.created) > cutoff)
  .filter(textOnly);

// ---------------------------------------------------------------- archived parameters
const { parameterBatches } = readArchiveFiles();
const parameterRows = parameterBatches.flatMap(({ file, rows }) =>
  rows.map(({ raw }) => ({ ...raw, file: file.replace(/\.jsonl$/, "") })));

// ---------------------------------------------------------------- the strings each candidate owns
// Parameter batches are scanned too, and leaving them out was a bug the audit caught rather than a
// simplification. `check:models` fails when an unmapped `model_raw` differs from an alias only in
// casing or separators, because alias resolution is exact and such a row is silently dropped — and
// the first run of the write path produced exactly that: it wrote `Muse Spark 1.2 (xhigh)` from an
// observation batch and left `muse-spark-1.2 (xHigh)` in batch 22 unmapped. The attribution gate
// learned the same lesson on its own first live run, with `GPT 5.5 (high)` and `GPT-5.5 (High)`.
// Whatever writes aliases must be closed under that equivalence, so it has to see every batch.
const { batches } = readArchiveFiles();
const unaliased = [];
for (const { file, rows } of [...batches, ...parameterBatches]) {
  for (const { raw } of rows) {
    // Observation rows carry `reasoning_effort`; parameter rows carry `effort`.
    const effort = raw.reasoning_effort ?? raw.effort ?? null;
    if (resolveModelId(raw.model_raw, effort, file)) continue;
    unaliased.push({ file: file.replace(/\.jsonl$/, ""), modelRaw: raw.model_raw, effort });
  }
}

// Same match as the counter, and deliberately the same: see the header.
const matchesNeedle = (key, needle) =>
  key === needle || (key.startsWith(needle) && !/^[0-9]/.test(key.slice(needle.length)));

const stringsFor = (item) => {
  const needles = [norm(item.id.split("/").slice(1).join("/")), norm(item.name ?? "")]
    .filter((needle) => needle.length > 3);
  const seen = new Set();
  return unaliased.filter((row) => {
    if (!needles.some((needle) => matchesNeedle(norm(row.modelRaw), needle))) return false;
    if (seen.has(row.modelRaw)) return false;
    seen.add(row.modelRaw);
    return true;
  });
};

// ---------------------------------------------------------------- the record
const num = (value) => (Number.isFinite(value) ? value : "null");
const SHADES = ["#2d71b9", "#7a4fd0", "#c2593f", "#3f8f7a", "#b0873a", "#8f4f8f", "#4f6f9f", "#9f5f4f"];

const draft = (item, params) => {
  const id = item.id.split("/").slice(1).join("/");
  const name = (item.name ?? id).replace(/^[^:]+:\s*/, "");
  const maker = params?.maker ?? item.id.split("/")[0];
  const used = new Set(MODELS.filter((model) => model.maker === maker).map((model) => model.color));
  const colour = SHADES.find((shade) => !used.has(shade)) ?? SHADES[0];
  const contextK = Number.isFinite(item.context_length) ? Math.round(item.context_length / 1024) : "null";
  return [
    `  m("${id}", "${name}", "${maker}", "${colour}", false, ${contextK}, [], [`,
    `    cfg(${params?.effort ? `"${params.effort}"` : "null"}, ${num(params?.intelligence_index)}, ` +
      `${num(params?.cost_per_task_usd)}, ${num(params?.output_tokens_per_s)}, ${num(params?.latency_first_chunk_s)}, ` +
      `${num(params?.price_input_per_m)}, ${num(params?.price_output_per_m)}, false, ${num(params?.price_cache_per_m)}),`,
    "  ]),",
  ].join("\n");
};

// ---------------------------------------------------------------- verdicts
const qualified = [];
console.log(`\n## Catalog candidates — floor ${floor} cells (${filled} filled / ${MODELS.length} models)\n`);
if (candidates.length === 0) console.log("No text model in a watched namespace is missing from the catalog.");

for (const item of candidates) {
  const evidence = lookupEvidence([item.id.split("/").slice(1).join("/"), item.name ?? ""]);
  const strings = stringsFor(item);
  const clears = evidence.cells.length > floor;
  console.log(
    `- \`${item.id}\` — ${evidence.cells.length} cell(s) from ${strings.length} unaliased string(s): ` +
    (clears ? "**clears the floor**" : `under the ${floor}-cell floor, left for a reader`),
  );
  if (evidence.cells.length) console.log(`  ${evidence.cells.sort().join(", ")}`);
  if (!clears) continue;
  const id = item.id.split("/").slice(1).join("/");
  const params = parameterRows.find((row) => norm(row.model_raw) === norm(id) && row.file === "batch-14-aa-parameters");
  qualified.push({ item, strings, evidence, record: draft(item, params) });
}

if (qualified.length === 0) {
  console.log("\nNothing qualifies. That is the expected steady state — a model below the floor is a queue item, not a defect.");
  process.exit(0);
}

console.log(`\n${qualified.length} qualify:\n`);
for (const entry of qualified) {
  console.log(entry.record);
  console.log(`  + ${entry.strings.length} alias(es): ${entry.strings.map((s) => s.modelRaw).join(", ")}\n`);
}

if (!write) {
  console.log("Report only. Re-run with --write to apply, then run the full contract.");
  process.exit(0);
}

// ---------------------------------------------------------------- write
const catalogPath = join(ROOT, "app/model-data.ts");
let catalog = readFileSync(catalogPath, "utf8");
const anchor = "\n];\n\n\nexport const AXES";
if (!catalog.includes(anchor)) throw new Error("could not find the end of the MODELS array — refusing to guess where a record goes");

const nextConfig = loadAliasConfig();
for (const entry of qualified) {
  const id = entry.item.id.split("/").slice(1).join("/");
  catalog = catalog.replace(anchor, `\n${entry.record}${anchor}`);
  for (const string of entry.strings) {
    nextConfig.aliases.push({
      modelRaw: string.modelRaw,
      effort: "*",
      modelId: id,
      reason:
        `Written by scripts/propose-model.mjs together with the catalog record, because the two are ` +
        `one decision: this string is among the ${entry.evidence.cells.length} the model was admitted on. ` +
        `Matched by the normalised, version-guarded rule in scripts/lib/upstream-evidence.mjs — the same ` +
        `rule that counted the cells — whose error profile is replayed against every catalog model by ` +
        `its --self-test. No human read this string.`,
    });
  }
}
writeFileSync(catalogPath, catalog);
writeFileSync(join(ROOT, "data/model-aliases.json"), `${JSON.stringify(nextConfig, null, 2)}\n`);
console.log(`Wrote ${qualified.length} record(s) and their aliases. Run: npm run ingest && the full contract.`);
