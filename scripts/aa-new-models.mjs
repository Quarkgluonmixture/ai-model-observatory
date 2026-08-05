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
import { artificialAnalysis } from "./fetchers/artificial-analysis.mjs";
import { buildResolvers, loadAliasConfig } from "./lib/archive.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const quiet = process.argv.includes("--quiet");
const say = (line = "") => { if (!quiet) console.log(line); };

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

// A model with no intelligence index cannot become a catalog record — `cfg()` requires one and
// its field source is fixed to AA. Reporting it as collectable would send somebody after a record
// they cannot write, so it is counted separately and named.
const ready = [...fresh.values()].filter((row) => Number.isFinite(row.intelligence_index));
const waiting = [...fresh.values()].filter((row) => !Number.isFinite(row.intelligence_index));

// Only a model AA has measured *since the archive was written* needs a fetch. The rest are ready
// to record right now, which is a different sentence and a different action.
const needsFetch = ready.filter((row) => !archived.has(row.model_raw));

if (ready.length) {
  say("## Artificial Analysis has measured models this catalog does not carry");
  say();
  for (const row of ready.sort((a, b) => b.intelligence_index - a.intelligence_index)) {
    const price = row.price_input_per_m != null ? `$${row.price_input_per_m}/$${row.price_output_per_m}` : "price not published";
    say(`- **${row.model_raw}** (${row.maker}, 发布 ${publishedOn(row) ?? "?"}) — intelligence ${row.intelligence_index}, ${price}` +
      `${row.effort ? `, effort ${row.effort}` : ""}${row.note ? ` · ${row.note}` : ""}`);
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

console.log(`<!-- aa-new-models: ${ready.length} -->`);
// The workflow dispatches a refresh on this one: fetching AA again for a model already archived
// would re-read 591 configurations to learn nothing.
console.log(`<!-- aa-needs-fetch: ${needsFetch.length} -->`);
