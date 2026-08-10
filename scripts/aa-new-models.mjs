// Asks one question: has Artificial Analysis started measuring a model this catalog has never
// heard of, from a maker this catalog tracks?
//
//   node scripts/aa-new-models.mjs            # report, exit 0
//   node scripts/aa-new-models.mjs --quiet    # only the marker line, for a workflow to read
//
// Why this exists. AA is `versioning: "manual"` and deliberately absent from the daily refresh:
// it re-measures speed, latency and cost continuously, so a scheduled rewrite would turn
// `check:models` red every morning and a check that is always red is a check nobody reads. That
// reasoning is sound and it had an unintended consequence — "not daily" became "somebody has to
// sit at a machine with the API key and run it", which is the last manual step between a model
// being published and a catalog record existing. Qwen3.8 Max sat behind exactly that step.
//
// The way out is to separate the two things AA does. A re-measurement is noise: daily, expected,
// and not actionable. A *new model appearing* is signal: rare, and the one thing the catalog is
// waiting for. This reports only the second, so the daily job can act on it without being woken
// by the first.
//
// It reports; it does not collect. The workflow decides what to do with a non-zero count.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS } from "../app/model-data.ts";
import { tierWordOf } from "../app/upstream-variants.ts";
import { artificialAnalysis } from "./fetchers/artificial-analysis.mjs";
import { buildResolvers, loadAliasConfig, readArchiveFiles } from "./lib/archive.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const quiet = process.argv.includes("--quiet");
const say = (line = "") => { if (!quiet) console.log(line); };

// A pricing or service tier is not a new model, and AA indexes it as its own row: `Claude Opus 5
// (batch)`, `Claude Opus 5 (Fast)`, `Inkling (batch)`. The alias check further down cannot catch
// them — nothing resolves a string the catalog has never been told about — so on 2026-08-10 five of
// the eight names in this report were tiers of models already on the board. That is not only noise
// on a page: a tier counted in the marker at the end dispatches an AA refresh that re-reads 591
// configurations to learn nothing.
//
// The closed keyword list and the reasoning for every word on it live in
// `app/upstream-variants.ts`, which is the one home for this rule: it was written here and in
// `report-gaps.mjs` and applied in neither the site's own copy of the list, which is how the daily
// issue came out clean while quarkspace.top showed the five tiers to every reader.
const tierOf = (modelRaw) => tierWordOf(modelRaw);

// The classifier is the whole risk in this file — too greedy and a real model stops being reported —
// so it is asserted rather than described. It runs above the API-key check so `--self-test` needs no
// key. Both directions matter, and the negative cases are the ones that would hurt: every string
// below is real, taken from AA's own index on 2026-08-10.
if (process.argv.includes("--self-test")) {
  const cases = [
    ["Claude Opus 5 (batch)", "batch"],
    ["Claude Opus 5 (Fast)", "fast"],
    ["Gemini 3.6 Flash (batch)", "batch"],
    ["Gemini 3.5 Flash Lite (batch)", "batch"],
    ["Inkling (batch)", "batch"],
    // Models, every one of them. A preview and a "Lite" are different weights, not a price tier.
    ["Muse Spark 1.2", null],
    ["Qwen3.7 Flash", null],
    ["Gemini 3.5 Flash Lite", null],
    ["Gemini 3.1 Pro Preview", null],
    ["Qwen3.6 Max Preview", null],
    ["Inkling Small", null],
    ["GPT-5.6 Sol (high)", null],        // an effort, which `resolveModelId` already handles
    ["Claude Opus 5", null],
    [undefined, null],
  ];
  let failed = 0;
  for (const [input, expected] of cases) {
    const actual = tierOf(input);
    if (actual !== expected) {
      console.log(`FAIL  ${JSON.stringify(input)} → ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
      failed += 1;
    }
  }
  console.log(failed === 0 ? `tierOf: ${cases.length}/${cases.length} cases pass` : `tierOf: ${failed} case(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

if (!process.env.AA_API_KEY) {
  say("AA_API_KEY is not set; cannot ask Artificial Analysis what it has added.");
  console.log("<!-- aa-new-models: 0 -->");
  process.exit(0);
}

// The makers this catalog actually carries, measured from the catalog rather than declared. Adding
// a lab to the catalog adds it to this watch with no second list to maintain — the same rule the
// namespace watch in report:gaps follows.
const TRACKED = new Set(MODELS.map((model) => model.maker.toLowerCase()));

const { resolveModelId } = buildResolvers(loadAliasConfig());

// What the archive already holds — used to decide whether to *trigger* a refresh, never to decide
// what to report.
//
// This filter used to suppress the report as well, on the reasoning that a model AA added last
// month and "we chose not to catalog" should not be raised every morning. That reasoning was
// wrong, and wrong in the way that matters: nobody chose. Batch 14 carries AA's entire list, so
// suppressing everything archived suppressed exactly the actionable set — models AA has already
// measured, whose parameters are already on disk, that need nothing but a catalog record. Gemini
// 3.5 Flash Lite sat in that blind spot with an intelligence index and three batches of benchmark
// evidence, invisible to the one check built to find it.
const archived = new Set();
try {
  const file = join(ROOT, `data/sources/${artificialAnalysis.batch}.jsonl`);
  for (const line of readFileSync(file, "utf8").trim().split("\n")) {
    archived.add(JSON.parse(line).model_raw);
  }
} catch { /* no archive yet: everything is new, which is correct on a first run */ }

const { rows } = await artificialAnalysis.fetch();

// Published recently. Without this the report is 213 models long and includes GPT-3.5 Turbo:
// "Artificial Analysis measured it and the catalog has no alias for it" is true of most of the
// last three years. The window matches the namespace watch and the release probe, so the three
// detectors agree on what "new" means. AA states the date in each row's own note.
const WINDOW_DAYS = 90;
const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const publishedOn = (row) => /发布 (\d{4}-\d{2}-\d{2})/.exec(row.note ?? "")?.[1] ?? null;

const fresh = new Map();
for (const row of rows) {
  if (!TRACKED.has(String(row.maker ?? "").toLowerCase())) continue;
  const published = publishedOn(row);
  if (!published || published < cutoff) continue;
  // An alias that already resolves means the catalog knows this family under another spelling —
  // AA adding a second effort variant of a model we carry is not a new model.
  if (resolveModelId(row.model_raw, row.effort, artificialAnalysis.batch)) continue;
  if (!fresh.has(row.model_raw)) fresh.set(row.model_raw, row);
}

// How much benchmark evidence is already archived for each candidate. This is the number that
// decides whether a record is worth writing, and the report did not carry it: "Artificial Analysis
// measured it" says a record is *possible*, not that it is *useful*. A record with two cells draws
// an empty row across sixty-eight columns and lowers cell coverage — the catalog already carries
// three models like that, and they are a debt rather than a precedent.
const evidenceCount = (() => {
  const { batches } = readArchiveFiles();
  const norm = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  const byModel = new Map();
  for (const { rows: archiveRows } of batches) {
    for (const { raw } of archiveRows) {
      if (!raw.benchmark) continue;
      const key = norm(raw.model_raw);
      (byModel.get(key) ?? byModel.set(key, new Set()).get(key)).add(raw.benchmark);
    }
  }
  return (modelRaw) => byModel.get(norm(modelRaw))?.size ?? 0;
})();

// `tierOf` is declared at the top of this file, above the key check, with the reasoning and a
// `--self-test`. The test here is a CONJUNCTION: a tier keyword *and* an empty archive. A `(batch)`
// row that somehow carries benchmark evidence stays in the report for a person to look at, because
// the expensive mistake is silently dropping a model, not printing one extra line.
const isTier = (row) => tierOf(row.model_raw) && evidenceCount(row.model_raw) === 0;
const tiers = [...fresh.values()].filter(isTier);
const models = [...fresh.values()].filter((row) => !isTier(row));

// A model with no intelligence index cannot become a catalog record — `cfg()` requires one and
// its field source is fixed to AA. Reporting it as collectable would send somebody after a record
// they cannot write, so it is counted separately and named.
const ready = models.filter((row) => Number.isFinite(row.intelligence_index));
const waiting = models.filter((row) => !Number.isFinite(row.intelligence_index));

// Only a model AA has measured *since the archive was written* needs a fetch. The rest are ready
// to record right now, which is a different sentence and a different action.
const needsFetch = ready.filter((row) => !archived.has(row.model_raw));

if (ready.length) {
  say("## Artificial Analysis has measured models this catalog does not carry");
  say();
  for (const row of ready.sort((a, b) => b.intelligence_index - a.intelligence_index)) {
    const price = row.price_input_per_m != null ? `$${row.price_input_per_m}/$${row.price_output_per_m}` : "price not published";
    const cells = evidenceCount(row.model_raw);
    say(`- **${row.model_raw}** (${row.maker}, 发布 ${publishedOn(row) ?? "?"}) — intelligence ${row.intelligence_index}, ${price}` +
      `${row.effort ? `, effort ${row.effort}` : ""} · **归档证据 ${cells} 格**` +
      `${cells < 8 ? " ⚠ 太薄,建档会画出一整行空格并拉低覆盖率" : ""}`);
  }
  say();
  say("Their operating parameters are what a catalog record needs and cannot get anywhere else.");
  if (needsFetch.length) {
    say(`${needsFetch.length} of them are newer than the archive and need \`node scripts/fetch-source.mjs aa\` first.`);
  }
  const ready_now = ready.length - needsFetch.length;
  if (ready_now > 0) {
    say(`**${ready_now} need nothing fetched** — their parameters are already archived. ` +
      "`npm run draft:model -- --all-new` drafts the record; what is missing is the record, not the data.");
  }
  say();
}

if (waiting.length) {
  say(`_${waiting.length} further model(s) are listed by AA but carry no intelligence index yet, ` +
    `so no catalog record can be written for them: ${waiting.map((row) => row.model_raw).join(", ")}._`);
  say();
}

// Named but not listed as work, and never as a `- **name**` bullet: this group is settled, and
// re-deciding a settled question every morning is how a reader learns to skim the whole report.
// The count stays visible because a silent filter is how a real model would disappear.
if (tiers.length) {
  say(`_${tiers.length} row(s) are a **pricing or service tier** of a model, not a model: ` +
    `${tiers.map((row) => `${row.model_raw} (${tierOf(row.model_raw)})`).join(", ")}. ` +
    "Same weights at a different price — they belong in `configurations` or a batch meta, never in " +
    "a catalog record of their own (AGENTS.md rule 7), so they are excluded from the count below " +
    "and from the refresh it triggers. Matched on a closed keyword list **and** an empty archive._");
  say();
}

console.log(`<!-- aa-new-models: ${ready.length} -->`);
// The workflow dispatches a refresh on this one: fetching AA again for a model already archived
// would re-read 591 configurations to learn nothing.
console.log(`<!-- aa-needs-fetch: ${needsFetch.length} -->`);
