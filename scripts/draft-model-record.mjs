// Drafts the catalog record for a model whose parameters are already in the archive.
//
//   node scripts/draft-model-record.mjs --all-new       # every AA model the catalog lacks
//   node scripts/draft-model-record.mjs qwen3.8-max     # one, by its archived model_raw
//
// Model records are hand-authored because they carry editorial content — display name, colour,
// tags, ordering — that has no source to generate from. That is still true. What is not true is
// that the *numbers* need typing: every one of them is already in `data/sources/`, and
// `check:models` exists precisely to catch the ones that get typed wrong.
//
// So this drafts the record from the archive and marks what it could not source. It prints; it
// never writes. Placing a record in app/model-data.ts is a new mapping, and the reviewer's job is
// the part this cannot do: is the display name right, does the colour collide, is this model
// actually worth carrying.
//
// The one number that blocks everything is the intelligence index. `cfg()` requires it, its field
// source is fixed to Artificial Analysis, and inventing it is not an option — so a model AA has
// not measured yet cannot get a record no matter how much benchmark evidence exists. That is why
// Qwen3.8 Max had 35 cells of archived evidence and no row on the site.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS } from "../app/model-data.ts";
import { buildResolvers, loadAliasConfig, readArchiveFiles } from "./lib/archive.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const allNew = args.includes("--all-new");
const wanted = args.filter((arg) => !arg.startsWith("--"));

const config = loadAliasConfig();
const { resolveModelId } = buildResolvers(config);
const TRACKED = new Set(MODELS.map((model) => model.maker.toLowerCase()));

// Every maker already has a colour range in the catalog; reusing one keeps the palette coherent
// and makes it obvious in review when a draft picked a shade that collides with a sibling.
const paletteOf = (maker) => MODELS.filter((model) => model.maker === maker).map((model) => model.color);

const parameterRows = [];
for (const file of ["batch-14-aa-parameters", "batch-15-model-config", "batch-08-operating", "batch-10-standard-pricing"]) {
  try {
    for (const line of readFileSync(join(ROOT, `data/sources/${file}.jsonl`), "utf8").trim().split("\n")) {
      parameterRows.push({ ...JSON.parse(line), file });
    }
  } catch { /* an absent batch is not an error here */ }
}

const candidates = allNew
  ? [...new Map(parameterRows
      .filter((row) => row.file === "batch-14-aa-parameters")
      .filter((row) => TRACKED.has(String(row.maker ?? "").toLowerCase()))
      .filter((row) => !resolveModelId(row.model_raw, row.effort, row.file))
      .filter((row) => Number.isFinite(row.intelligence_index))
      .map((row) => [row.model_raw, row])).values()]
  : wanted.map((name) => parameterRows.find((row) => row.model_raw === name)).filter(Boolean);

if (candidates.length === 0) {
  console.log(allNew
    ? "No Artificial Analysis model is both untracked and measured — nothing to draft."
    : `No archived parameter row for ${wanted.join(", ")}.`);
  process.exit(0);
}

// Observation rows already waiting on this model. They are the argument for carrying it: a record
// with no evidence renders an empty row across 68 columns and *lowers* cell coverage.
const { batches } = readArchiveFiles();
const evidenceFor = (modelRaw) => {
  const stem = modelRaw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cells = new Set();
  for (const { rows } of batches) {
    for (const { raw } of rows) {
      if (!raw.benchmark) continue;
      if (String(raw.model_raw).toLowerCase().replace(/[^a-z0-9]/g, "") !== stem) continue;
      cells.add(raw.benchmark);
    }
  }
  return cells;
};

const num = (value) => (Number.isFinite(value) ? value : "null");

for (const row of candidates) {
  // AA writes the display name into the row's note as "AA 名称 X；发布 Y" — the only place a
  // human-facing name exists in the archive at all.
  const published = /AA 名称 ([^；;]+)/.exec(row.note ?? "")?.[1]?.trim();
  // Strip the operating point out of the display name. AA prints "Kimi K3 (low)" and
  // "Claude Opus 5 (Reasoning, Max Effort)"; the catalog holds one record per family and the
  // effort lives on the configuration, so a name carrying it would create a second record for a
  // model that already exists — the exact collapse that raised ingestion from 179 rows to 214.
  const name = (published ?? row.model_raw)
    .replace(/\s*\((Reasoning|Non-reasoning|Adaptive Reasoning)?[^)]*?(Effort|reasoning|max|xhigh|high|medium|low|minimal)[^)]*\)\s*$/i, "")
    .trim() || row.model_raw;
  const id = row.model_raw;
  const palette = paletteOf(row.maker);
  const contextRow = parameterRows.find((other) => other.model_raw === row.model_raw && Number.isFinite(other.context_k));
  const cells = evidenceFor(row.model_raw);

  console.log(`### ${name}`);
  console.log();
  console.log(`Archived evidence: ${cells.size} benchmark(s)${cells.size ? ` — ${[...cells].slice(0, 10).join(", ")}` : " — none yet"}`);
  if (cells.size === 0) {
    console.log("⚠ No observation rows resolve to this model. A record with no evidence renders an");
    console.log("  empty row across 68 columns and lowers cell coverage. Add the aliases first, or wait.");
  }
  console.log();
  console.log("```ts");
  console.log(`  m("${id}", "${name}", "${row.maker}", "${palette[0] ?? "#888888"}", ${row.open_weights === true}, ${num(contextRow?.context_k ?? row.context_k)}, [], [`);
  console.log(`    cfg(${row.effort ? `"${row.effort}"` : "null"}, ${num(row.intelligence_index)}, ${num(row.cost_per_task_usd)}, ` +
    `${num(row.output_tokens_per_s)}, ${num(row.latency_first_chunk_s)}, ${num(row.text_elo)}, ${num(row.code_elo)}, ` +
    `${num(row.price_input_per_m)}, ${num(row.price_output_per_m)}, false, ${num(row.price_cache_per_m)}),`);
  console.log("  ]),");
  console.log("```");
  console.log();
  if (palette.length === 0) {
    console.log(`⚠ No catalog model is filed under maker "${row.maker}". Artificial Analysis and this`);
    console.log(`  catalog disagree about the name — AA says "Kimi" where the catalog says "Moonshot",`);
    console.log("  for instance. Use the catalog's spelling or the model will not group with its siblings.");
    console.log();
  }
  console.log("Not drafted, because nothing sources them:");
  console.log(`- **colour** — \`${palette[0] ?? "#888888"}\` is ${row.maker}'s first shade and will collide with a sibling; pick a free one`);
  console.log("- **tags** — empty above. They are editorial and drive the filter chips.");
  console.log(`- **aliases** — every source spells this differently; \`npm run ingest\` lists the unmapped strings`);
  if (!contextRow?.context_k && !row.context_k) console.log("- **context window** — no archive row; batch 15 reads it from the model's own config.json");
  console.log();
  console.log(`Then: \`npm run ingest && npm run check:models\`. The audit will tell you which of the`);
  console.log("numbers above disagree with the archive, which is the whole point of not typing them.");
  console.log();
}
