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
import { buildResolvers } from "./lib/archive.mjs";

// fileURLToPath, not .pathname: on Windows a file URL's pathname is "/C:/..." — a
// leading slash that fs cannot resolve. The agent maintaining this runs there.
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_DIR = join(ROOT, "data/sources");
const config = JSON.parse(readFileSync(join(ROOT, "data/model-aliases.json"), "utf8"));

const aliasFor = new Map(config.aliases.map((alias) => [alias.modelRaw, alias.modelId]));
// The same resolver ingestion uses, so a file-scoped alias means the same thing to the audit as
// it does to the observation store. Reading `aliasFor` here instead would ignore the scope and
// audit the catalog against a row the dashboard never accepted.
const { resolveModelId, supersededBy } = buildResolvers(config);
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
    rows.push({ ...JSON.parse(line), file, retrievedDate: meta.retrievedDate ?? "" });
  }
}

if (!rows.length) {
  console.error("No model-parameter batches found in data/sources; cannot audit the catalog.");
  process.exit(1);
}

// LMArena is an Elo source. Its price column disagrees with official pages and with this
// catalog, so it must never satisfy a price check. See batch-06's fieldSourcePolicy.
// Both domains: lmarena.ai now redirects to arena.ai, and the scripted batch cites the new one.
// Matching only the old host would have quietly re-opened the door this guard exists to hold shut.
const isArena = (row) => /(^|\/\/|\.)(lm)?arena\.ai/.test(row.source_url ?? "");

const effortIndex = new Map();
const modelIndex = new Map();
// Every reading of a parameter field, with the batch it came from, so the report at the end can
// say when the value being audited against is not the newest one on file. See `staleSlots`.
const slotReadings = new Map();
const auditedKeys = new Set();
for (const row of rows) {
  const modelId = resolveModelId(row.model_raw, row.effort, row.file);
  if (!modelId) continue;

  // Each field takes whichever row supplies it FIRST, and files are read in name order — so an
  // early batch holds the slot against every later one, and a value it froze there stays "backed"
  // however far the source has since moved. That is not hypothetical: batch 07 pinned Qwen3.7
  // Max's cost at 1.28 while AA's current reading was 0.5413, and this audit called it green.
  // `supersededRows` is how the archive says which reading wins, and it was already honoured on
  // the price path below — it just was never consulted here, on the four fields where the same
  // question arises most often. Scoped entries only; nothing matches unless one names this file.
  const perEffort = effortIndex.get(`${modelId}|${norm(row.effort)}`) ?? {};
  for (const field of ["intelligence_index", "cost_per_task_usd", "output_tokens_per_s", "latency_first_chunk_s"]) {
    if (row[field] == null) continue;
    if (supersededBy(row.file, null, null, field, row.model_raw)) continue;
    const slot = `${modelId}|${norm(row.effort)}|${field}`;
    slotReadings.set(slot, [...(slotReadings.get(slot) ?? []), { file: row.file, value: row[field] }]);
    if (perEffort[field] == null) perEffort[field] = row[field];
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
const caseErrors = [];
const variantErrors = [];
let backed = 0;
const legacy = [];
const disputed = [];


// Spelling-orphan guard. Alias resolution is exact, so a model_raw that differs from a mapped
// key only in how it is *written* silently fails to resolve and the row is dropped from ingest.
// PR #10 caught one such case (Inkling xhigh vs xHigh) only because a human noticed a score had
// gone missing. This surfaces them automatically — a string that matches an existing alias except
// for spelling is almost certainly a transcription artefact, not a deliberate unmapped model.
//
// Casing alone was too narrow. It missed "GPT 5.5 (xhigh)" against "GPT-5.5 (xhigh)" — a space
// where the alias has a hyphen — and that row sat dropped in batch-02-coding until an audit
// looked for it. So the key also ignores spaces, hyphens and underscores.
//
// Dots, parentheses and slashes are deliberately KEPT. A dot separates a version (5.5 is not 55)
// and a slash namespaces a publisher (zai-org/glm-4.7 is a different string from glm-4.7 on
// purpose); folding either would invent collisions between models that really are distinct.
const spell = (raw) => raw.toLowerCase().replace(/[\s\-_]+/g, "");
const aliasRawLower = new Map([...aliasFor.keys()].map((raw) => [spell(raw), raw]));
for (const file of readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".jsonl")).sort()) {
  for (const line of readFileSync(join(SOURCE_DIR, file), "utf8").split("\n").filter((l) => l.trim())) {
    let parsed;
    try { parsed = JSON.parse(line); } catch { continue; }
    const { model_raw } = parsed;
    if (model_raw == null || aliasFor.has(model_raw)) continue;
    const mapped = aliasRawLower.get(spell(model_raw));
    if (mapped) {
      caseErrors.push(
        `${file}: model_raw "${model_raw}" matches alias "${mapped}" except for spelling ` +
        `(casing, spaces or hyphens) — alias resolution is exact, so this row is silently ` +
        `dropped from ingest.`,
      );
    }
  }
}

// Variant-tier guard. A wrong alias is the most dangerous edit in this repository: it reports
// one model's score as another's, and no other check can see it — the row is well-formed, the
// version matches, the harness is named, the arithmetic is fine. Only the meaning is wrong.
//
// One family of that mistake is mechanical enough to catch. A vendor's size or tier word names a
// DIFFERENT PRODUCT, not an operating point of the same one: Flash-Lite is not Flash at low
// effort, GPT-5.5 Pro is not GPT-5.5, Inkling Small is not Inkling. So a published string
// carrying such a word must not map to a catalog id that lacks it.
//
// The word list is deliberately short. `preview`, `thinking` and `codex` were measured and left
// out: all 27 aliases they matched were legitimate — the catalog model *is* the preview, thinking
// is a mode, and codex is a harness printed inside the model string. With the list below, zero of
// the 219 current aliases trip, and four of the six near-misses recorded in the alias file's
// `_doc` would have been caught.
const VARIANT_TIERS = ["pro", "lite", "mini", "nano", "small", "air", "turbo", "plus", "fast"];
const words = (value) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
for (const alias of config.aliases) {
  if (alias.allowVariant) continue; // an explicit, reasoned exception on the alias entry
  if (alias.modelId == null) continue; // a scoped refusal maps to nothing, so there is no tier to compare
  const raw = words(alias.modelRaw);
  const target = words(alias.modelId);
  const extra = VARIANT_TIERS.filter((tier) => raw.has(tier) && !target.has(tier));
  if (extra.length) {
    variantErrors.push(
      `alias "${alias.modelRaw}" -> ${alias.modelId}: the published string says ` +
      `${extra.map((tier) => `"${tier}"`).join(", ")} and the catalog id does not. A size or tier ` +
      `word names a different product, not an operating point. If this mapping really is correct, ` +
      `add "allowVariant": true to the entry with a reason.`,
    );
  }
}

// Prefer the row that describes the flagship configuration, then a row with no effort at
// all, then anything. Without this the answer would depend on archive line order.
// A row whose value for `field` has been declared superseded (supersededRows with a
// `field` key) is excluded — the replacement batch carries the value the catalog should
// see, while the original row stays in the archive untouched.
const pickModelLevel = (model, field, allow = () => true) => {
  const raw = (modelIndex.get(model.id) ?? []).filter(
    (row) => row[field] != null && allow(row) && !supersededBy(row.file, null, null, field, row.model_raw),
  );
  if (!raw.length) return null;
  // Newest first, then the three rungs. Without the sort the rungs pick by archive file order,
  // which was harmless while a source was read once and became wrong the moment one was read
  // twice: a re-fetched Arena board put a second row beside the hand-read one and the audit kept
  // choosing the ten-day-old value, then reported the fresh catalog as contradicting the archive.
  // An older reading of a moving number is simply worse — the same rule ingestion derives by.
  const candidates = raw.slice().sort((a, b) => String(b.retrievedDate).localeCompare(String(a.retrievedDate)));
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
    auditedKeys.add(key);
    auditedKeys.add(`${model.id}|null`);
    // AA names an operating point in two dimensions and the catalog names it in one. "DeepSeek V4
    // Pro (Reasoning, Max Effort)" is archived as `reasoning max`, because dropping the mode is
    // what once put a reasoning and a non-reasoning row in the same cell; the catalog labels the
    // same operating point `max`. So a bare level also accepts a compound effort ending in it —
    // but ONLY when exactly one exists. If a model publishes both `reasoning high` and
    // `non-reasoning high`, that is the collision the two-dimension rule exists to keep apart, and
    // this stays silent rather than guessing which one the catalog meant. Measured 2026-08-12:
    // 6 compound rows in batch 14, across 6 models, none of them ambiguous.
    const compound = configuration.effort
      ? [...effortIndex.keys()].filter((candidate) => candidate.endsWith(` ${configuration.effort}`) &&
          candidate.startsWith(`${model.id}|`))
      : [];
    const viaCompound = compound.length === 1 ? effortIndex.get(compound[0]) : undefined;
    const archive = {
      ...(effortIndex.get(`${model.id}|null`) ?? {}),
      ...(viaCompound ?? {}),
      ...(effortIndex.get(key) ?? {}),
    };
    if (compound.length === 1) auditedKeys.add(compound[0]);
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

if (variantErrors.length) {
  console.error(
    "Alias maps a product tier onto a different model:\n" +
      variantErrors.map((error) => `- ${error}`).join("\n") +
      "\n\nCheck the source: is the published string really this catalog model at some operating\n" +
      "point, or is it the vendor's separate Lite / Mini / Pro / Small product? If it is a\n" +
      "different product it needs its own catalog record, or no mapping at all.\n",
  );
}
if (caseErrors.length) {
  console.error(
    "Unmapped model_raw matching an existing alias except for casing:\n" +
      caseErrors.map((error) => `- ${error}`).join("\n") +
      "\n\nAdd the correctly-cased variant to data/model-aliases.json. Do not rename the\n" +
      "model_raw string in the archive — another batch may use the existing casing, and\n" +
      "renaming one would orphan the other (see PR #10).",
  );
}
if (errors.length) {
  console.error(
    "Model catalog contradicts the archive:\n" +
      errors.map((error) => `- ${error}`).join("\n") +
      "\n\nEither the catalog is stale or the archive was re-transcribed. Fix the catalog, or\n" +
      "add the newer row to the archive - do not edit an archived value to match the catalog.",
  );
}
if (caseErrors.length || variantErrors.length || errors.length) process.exit(1);

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

// A slot that several batches have measured, where the audit is using the earliest of them.
//
// This is not a contradiction and it must not fail: the audit's rule is "the first batch that
// supplies a field wins", batches are read in name order, and that rule is what lets a hand
// transcription back a catalog value no scripted source has reached yet. But the same rule means
// a value frozen by an early batch stays "backed" no matter how far the source has since moved,
// and the audit will keep reporting 100% while the site publishes a stale number. Qwen3.7 Max's
// cost per task sat at batch 07's 1.28 for as long as this file has existed, against a batch 14
// reading of 0.5413 — a 2.4x gap on a flagship, and 321/321 green throughout.
//
// So the gap gets printed. Deciding which reading a catalog record should publish is editorial —
// AA re-measures speed and latency continuously and chasing every wobble is not the goal — and
// `supersededRows` is where that decision is written down, per model and per field.
const staleSlots = [];
for (const [slot, readings] of slotReadings) {
  const [modelId, effort, field] = slot.split("|");
  if (!auditedKeys.has(`${modelId}|${effort}`) || readings.length < 2) continue;
  const ordered = [...readings].sort((a, b) => a.file.localeCompare(b.file));
  const used = ordered[0];
  const newest = ordered[ordered.length - 1];
  if (used.file === newest.file || used.value === newest.value) continue;
  const drift = Math.abs(used.value - newest.value) / Math.max(Math.abs(used.value), Math.abs(newest.value));
  if (drift <= 0.05) continue;
  staleSlots.push(
    `${modelId} (${effort === "null" ? "default" : effort}) ${field}: using ${used.value} ` +
      `from ${used.file.replace(/\.jsonl$/, "")}, newest reading is ${newest.value} ` +
      `from ${newest.file.replace(/\.jsonl$/, "")} (${(100 * drift).toFixed(0)}% apart)`,
  );
}
if (staleSlots.length) {
  console.log(
    `\nAn earlier batch holds the slot against a newer reading more than 5% away ` +
      `(${staleSlots.length}; reported, not failed — see supersededRows):`,
  );
  for (const entry of staleSlots.sort()) console.log(`  ${entry}`);
}
