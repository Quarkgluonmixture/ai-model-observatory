// Audits every number on every MODELS record against the operating-parameter archive.
//
// Observation rows are generated from the archive, so they cannot drift. Model records are
// hand-authored, because they also carry editorial content - inclusion, display name, colour,
// tags, ordering - that has no source to generate it from. This script closes the same gap a
// generator would: it fails when a catalog number contradicts the archive, and it reports how
// much of the catalog has no archive row behind it at all.
//
// "legacy" here means exactly one thing: no row in data/sources/*.jsonl backs this number.
// It is not an accusation that the value is wrong, only that nothing on file supports it.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS } from "../app/model-data.ts";

// fileURLToPath, not .pathname: on Windows a file URL's pathname is "/C:/..." — a
// leading slash that fs cannot resolve. The agent maintaining this runs there.
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_DIR = join(ROOT, "data/sources");
const config = JSON.parse(readFileSync(join(ROOT, "data/model-aliases.json"), "utf8"));

const aliasFor = new Map(config.aliases.map((alias) => [alias.modelRaw, alias.modelId]));
const norm = (value) => (value == null ? null : String(value).toLowerCase());

// Promotional prices recorded in batch metas. The rows stay in the archive because a published
// discount is a real published fact, but the catalog quotes list price - so a promotional row
// must never be what backs a price check, the same way an Arena price never can.
const promotions = new Set();
for (const file of readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".meta.json"))) {
  const meta = JSON.parse(readFileSync(join(SOURCE_DIR, file), "utf8"));
  for (const term of meta.priceTerms ?? []) {
    promotions.add(`${term.modelId}|${term.promotional.input}|${term.promotional.output}`);
  }
}

// Load every archive batch that holds model parameters rather than observations.
const rows = [];
for (const file of readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".jsonl"))) {
  let meta;
  try {
    meta = JSON.parse(readFileSync(join(SOURCE_DIR, file.replace(/\.jsonl$/, ".meta.json")), "utf8"));
  } catch {
    continue;
  }
  if (!meta.schema?.startsWith("Model operating parameters")) continue;
  for (const line of readFileSync(join(SOURCE_DIR, file), "utf8").split("\n").filter((l) => l.trim())) {
    rows.push({ ...JSON.parse(line), file });
  }
}

if (!rows.length) {
  console.error("No model-parameter batches found in data/sources; cannot audit the catalog.");
  process.exit(1);
}

// LMArena is an Elo source. Its price column disagrees with official pages and with this
// catalog, so it must never satisfy a price check. See batch-06's fieldSourcePolicy.
const isArena = (row) => row.source_url?.includes("lmarena.ai");

const effortIndex = new Map();
const modelIndex = new Map();
for (const row of rows) {
  const modelId = aliasFor.get(row.model_raw);
  if (!modelId) continue;

  const perEffort = effortIndex.get(`${modelId}|${norm(row.effort)}`) ?? {};
  for (const field of ["intelligence_index", "cost_per_task_usd", "output_tokens_per_s", "latency_first_chunk_s"]) {
    if (row[field] != null && perEffort[field] == null) perEffort[field] = row[field];
  }
  effortIndex.set(`${modelId}|${norm(row.effort)}`, perEffort);

  // Price and Elo are model-level: providers price a model, and Arena publishes no
  // per-effort boards. Several effort variants can therefore map to one record, so keep
  // every candidate row and pick between them once the flagship effort is known.
  const candidates = modelIndex.get(modelId) ?? [];
  candidates.push(row);
  modelIndex.set(modelId, candidates);
}

const close = (a, b) => Math.abs(a - b) < 0.005;
const errors = [];
let backed = 0;
const legacy = [];
const disputed = [];

// Case-sensitivity orphan guard. Alias resolution is case-sensitive: a model_raw that
// differs from a mapped key only in casing silently fails to resolve and the row is
// dropped from ingest. PR #10 caught one such case (Inkling xhigh vs xHigh) only because a
// human noticed a score had gone missing from the generated output. This surfaces them
// automatically — a string that matches an existing alias except for casing is almost
// certainly a transcription error, not a deliberate unmapped model.
const aliasRawLower = new Map([...aliasFor.keys()].map((raw) => [raw.toLowerCase(), raw]));
for (const file of readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".jsonl")).sort()) {
  for (const line of readFileSync(join(SOURCE_DIR, file), "utf8").split("\n").filter((l) => l.trim())) {
    let parsed;
    try { parsed = JSON.parse(line); } catch { continue; }
    const { model_raw } = parsed;
    if (model_raw == null || aliasFor.has(model_raw)) continue;
    const mapped = aliasRawLower.get(model_raw.toLowerCase());
    if (mapped) {
      errors.push(
        `${file}: model_raw "${model_raw}" matches alias "${mapped}" except for casing — ` +
        `alias resolution is case-sensitive, so this row is silently dropped from ingest.`,
      );
    }
  }
}

// Prefer the row that describes the flagship configuration, then a row with no effort at
// all, then anything. Without this the answer would depend on archive line order.
const pickModelLevel = (model, field, allow = () => true) => {
  const candidates = (modelIndex.get(model.id) ?? []).filter((row) => row[field] != null && allow(row));
  if (!candidates.length) return null;
  const flagship = norm(model.configurations[0]?.effort);
  return (
    candidates.find((row) => norm(row.effort) === flagship) ??
    candidates.find((row) => row.effort == null) ??
    candidates[0]
  )[field];
};

for (const model of MODELS) {

  // Booleans cannot go through `check`, which compares numerically. Same verdicts otherwise:
  // absent from the archive is unsourced, present and different is a contradiction.
  const checkFlag = (label, catalogValue, archiveValue) => {
    if (catalogValue == null) return;
    if (archiveValue == null) { legacy.push(label); return; }
    if (catalogValue !== archiveValue) {
      errors.push(`${label}: catalog ${catalogValue} but archive says ${archiveValue}`);
      return;
    }
    backed += 1;
  };

  const check = (label, catalogValue, archiveValue) => {
    if (catalogValue == null) return;
    if (archiveValue == null) {
      legacy.push(label);
      return;
    }
    if (!close(catalogValue, archiveValue)) {
      errors.push(`${label}: catalog ${catalogValue} but archive says ${archiveValue}`);
      return;
    }
    backed += 1;
  };

  for (const configuration of model.configurations) {
    // A source that prints one row per model, with no effort column, still describes the
    // configuration the catalog labels. Fall back to it rather than calling the value
    // unsourced, the same way model-level fields resolve.
    // Fill field by field, not row by row: a source that prints one row per model with no
    // effort column still describes the configuration the catalog labels, but a source that
    // does split by effort must win wherever it actually published a value.
    const key = `${model.id}|${norm(configuration.effort)}`;
    const archive = { ...(effortIndex.get(`${model.id}|null`) ?? {}), ...(effortIndex.get(key) ?? {}) };
    const at = `${model.id} (${configuration.effort ?? "default"})`;
    if (!effortIndex.has(key) && !effortIndex.has(`${model.id}|null`) && configuration.intelligence != null) {
      legacy.push(`${at} - no archive row for this configuration`);
    }
    check(`${at} intelligence`, configuration.intelligence, archive.intelligence_index);
    check(`${at} costTask`, configuration.costTask, archive.cost_per_task_usd);
    check(`${at} speed`, configuration.speed, archive.output_tokens_per_s);
    check(`${at} latency`, configuration.latency, archive.latency_first_chunk_s);
  }

  // Official vendor pages outrank Artificial Analysis for price; LMArena and rows quoting a
  // recorded promotion never count.
  const isPromotional = (row) =>
    promotions.has(`${model.id}|${row.price_input_per_m}|${row.price_output_per_m}`);
  const usable = (row) => !isArena(row) && !isPromotional(row);
  const priceRow = (field) =>
    pickModelLevel(model, field, (row) => usable(row) && row.source_kind === "official") ??
    pickModelLevel(model, field, usable);
  check(`${model.id} price.input`, model.price.input, priceRow("price_input_per_m"));
  check(`${model.id} price.output`, model.price.output, priceRow("price_output_per_m"));
  check(`${model.id} textElo`, model.textElo, pickModelLevel(model, "text_elo"));
  check(`${model.id} codeElo`, model.codeElo, pickModelLevel(model, "code_elo"));

  // Context window and open-weights status are facts about the model, and the archive has
  // carried both since batch 06 — this audit simply never read them. Until it did, they were
  // the only catalog numbers that could be wrong without anything noticing, which is how
  // Qwen3.7 Plus arrived with a context length copied from a sibling record.
  //
  // `tags`, `color`, `name` and the ordering stay out of this deliberately: they are editorial,
  // they have no source to check against, and AGENTS.md says so.
  //
  // Source precedence matters here exactly as it does for price. An official vendor page
  // outranks Artificial Analysis — OpenAI publishes 1050K for GPT-5.6 Luna where AA measured
  // 1000K — and LMArena never counts, for the same reason its price column never counts: the
  // column is unlabelled, and where it can be compared it disagrees with everyone (it claims
  // 1100K for GPT-5.5 against AA's 922K).
  const fact = (field) =>
    pickModelLevel(model, field, (row) => !isArena(row) && row.source_kind === "official") ??
    pickModelLevel(model, field, (row) => !isArena(row));
  // Context length is REPORTED, not failed on. A 1,048,576-token window reaches this project as
  // 1000, 1049 or 1050 depending on who rounded it, so treating every difference as a
  // contradiction would manufacture corrections out of arithmetic. What is worth seeing is the
  // disagreement itself — inkling is carried at 1000K while Artificial Analysis says 256K, and
  // until now nothing said so. Open weights has no rounding excuse and stays a hard failure:
  // it drives the "open weights only" filter, so a wrong value hides or invents a model.
  const archivedContext = fact("context_k");
  if (archivedContext == null) legacy.push(`${model.id} contextK`);
  else if (Math.abs(model.contextK - archivedContext) > 0.1 * archivedContext) {
    disputed.push(`${model.id} contextK: catalog ${model.contextK}K, archive ${archivedContext}K`);
  } else backed += 1;
  checkFlag(`${model.id} open`, model.open, fact("open_weights"));
}

if (errors.length) {
  console.error(
    "Model catalog contradicts the archive:\n" +
      errors.map((error) => `- ${error}`).join("\n") +
      "\n\nEither the catalog is stale or the archive was re-transcribed. Fix the catalog, or\n" +
      "add the newer row to the archive - do not edit an archived value to match the catalog.",
  );
  process.exit(1);
}

const total = backed + legacy.length;
console.log(
  `Model provenance passed: ${backed}/${total} catalog values backed by data/sources ` +
    `(${((100 * backed) / total).toFixed(0)}%), ${legacy.length} with no archive row.`,
);
if (disputed.length) {
  console.log("\nCatalog and archive disagree by more than 10% (reported, not failed):");
  for (const entry of disputed) console.log(`  ${entry}`);
}
if (legacy.length) {
  console.log("\nNo archive row behind these (not necessarily wrong, just unsourced):");
  for (const entry of legacy) console.log(`  ${entry}`);
}
