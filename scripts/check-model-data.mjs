import {
  BENCHMARK_OBSERVATIONS,
  BENCHMARK_SCORES,
  BENCHMARKS,
  MODELS,
  OBSERVATION_ROWS,
  OBSERVATIONS_BY_CELL,
} from "../app/model-data.ts";
import { buildResolvers, loadAliasConfig, readArchiveFiles } from "./lib/archive.mjs";

const aliasConfig = loadAliasConfig();
const errors = [];
const modelIds = new Set(MODELS.map((model) => model.id));
const benchmarkIds = new Set(BENCHMARKS.map((benchmark) => benchmark.id));

const duplicateValues = (values) => values.filter((value, index) => values.indexOf(value) !== index);

for (const duplicate of duplicateValues(MODELS.map((model) => model.id))) {
  errors.push(`duplicate model id: ${duplicate}`);
}

for (const duplicate of duplicateValues(BENCHMARKS.map((benchmark) => benchmark.id))) {
  errors.push(`duplicate benchmark id: ${duplicate}`);
}

// Every observation row must be individually attributable.
const rowKeys = [];

for (const row of OBSERVATION_ROWS) {
  const cell = `${row.modelId}/${row.benchmarkId}`;

  if (!modelIds.has(row.modelId)) errors.push(`observations reference unknown model: ${row.modelId}`);
  if (!benchmarkIds.has(row.benchmarkId)) errors.push(`${cell} references unknown benchmark`);
  if (!Number.isFinite(row.score)) errors.push(`${cell} has a non-finite score`);
  if (!row.sourceId || !row.sourceLabel || !row.sourceUrl) errors.push(`${cell} is missing source provenance`);
  if (!row.benchmarkVersion) errors.push(`${cell} is missing a benchmark version`);

  // A source that publishes no evaluation date must still say when it was read, and the
  // transcription date must never be laundered into the evaluation date field.
  for (const [field, value] of [["evaluationDate", row.evaluationDate], ["retrievedDate", row.retrievedDate]]) {
    if (value != null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.push(`${cell} ${field} is not ISO: ${value}`);
  }
  if (!row.evaluationDate && !row.retrievedDate) errors.push(`${cell} has neither an evaluation date nor a retrieved date`);

  // A system-level result is meaningless without knowing what ran it, so a benchmark-native
  // system row must name its harness. Vendor tables often omit it and stay exempt.
  const benchmark = BENCHMARKS.find((entry) => entry.id === row.benchmarkId);
  if (benchmark?.mode === "system" && row.sourceKind === "benchmark" && !row.harness) {
    errors.push(`${cell} is a benchmark-native system result without a harness`);
  }

  // Unit plausibility. The cheapest guard against the "same name, different metric" mistake:
  // Epoch publishes a `gdpval` win rate while this catalog's `gdpval` is GDPval-AA, scored in
  // Elo by Artificial Analysis. Filing one under the other produces a row that satisfies every
  // structural check and means something entirely different. An Elo of 41 or a percentage of
  // 1686 is not a close call.
  if (benchmark?.unit === "Elo" && row.score < 200) {
    errors.push(`${cell} is an Elo benchmark but the score is ${row.score} — is this a percentage from a different metric?`);
  }
  if (benchmark?.unit === "%" && row.score > 100) {
    errors.push(`${cell} is a percentage benchmark but the score is ${row.score} — is this an Elo from a different metric?`);
  }

  rowKeys.push([
    row.modelId,
    row.benchmarkId,
    row.benchmarkVersion,
    row.harness ?? "-",
    row.reasoningEffort ?? "-",
    String(row.toolsEnabled),
    row.contextLength ?? "-",
    row.sourceId,
    String(row.score),
  ].join("|"));
}

for (const duplicate of new Set(duplicateValues(rowKeys))) {
  errors.push(`duplicate observation for the same configuration: ${duplicate}`);
}

// One cell renders as one table column, so its rows must all measure the same thing.
// Two benchmark versions in one cell means one model's score would be read against
// another model's different version. Give the second version its own benchmark id.
for (const [modelId, cells] of Object.entries(OBSERVATIONS_BY_CELL)) {
  for (const [benchmarkId, variants] of Object.entries(cells)) {
    const versions = [...new Set(variants.map((row) => row.benchmarkVersion))];
    if (versions.length > 1) {
      errors.push(`${modelId}/${benchmarkId} mixes benchmark versions in one cell: ${versions.join(", ")}`);
    }
  }
}

// Derived views must not invent anything the row store does not contain.
for (const [modelId, observations] of Object.entries(BENCHMARK_OBSERVATIONS)) {
  for (const [benchmarkId, observation] of Object.entries(observations)) {
    const variants = OBSERVATIONS_BY_CELL[modelId]?.[benchmarkId] ?? [];
    if (!variants.includes(observation)) {
      errors.push(`${modelId}/${benchmarkId} primary observation is not one of its rows`);
    }
    if (BENCHMARK_SCORES[modelId]?.[benchmarkId] !== observation.score) {
      errors.push(`${modelId}/${benchmarkId} score is not derived from its observation`);
    }
  }
}

for (const [modelId, scores] of Object.entries(BENCHMARK_SCORES)) {
  for (const benchmarkId of Object.keys(scores)) {
    if (!BENCHMARK_OBSERVATIONS[modelId]?.[benchmarkId]) {
      errors.push(`${modelId}/${benchmarkId} has a score without an observation`);
    }
  }
}

if (MODELS.length < 15) errors.push(`expected at least 15 models, found ${MODELS.length}`);
if (BENCHMARKS.length < 20) errors.push(`expected at least 20 benchmarks, found ${BENCHMARKS.length}`);
if (!BENCHMARK_OBSERVATIONS["gemini-3.5-flash"]?.terminal) {
  errors.push("Gemini 3.5 Flash must retain its official Terminal-Bench observation");
}

// Regression guard: the Terminal-Bench 2.1 leaderboard is transcribed per harness, so at least
// one model must carry more than one harness for that benchmark.
const multiHarness = Object.values(OBSERVATIONS_BY_CELL).some(
  (cells) => new Set((cells.terminal ?? []).map((row) => row.harness)).size > 1,
);
if (!multiHarness) errors.push("expected at least one model with multiple Terminal-Bench harnesses");

// Cross-source disagreement, reported and never failed on.
//
// Two sources measuring the SAME configuration — same model, benchmark, harness and reasoning
// effort — should land in the same neighbourhood. When they do not, one of them is measuring
// something else, and that is invisible today: both rows sit in the cell, source precedence
// silently picks a winner, and the loser becomes a "+n" the reader never opens.
//
// It found a real one immediately. Epoch's own CSV export puts Claude Opus 4.8 at 47.24 on
// FrontierMath while a transcription of Epoch's own web page recorded 80, and adding the scripted
// batch quietly changed the published figure from one to the other.
//
// This cannot be a failure: legitimate disagreements exist and resolving them is research, not a
// code fix. Grouping by harness AND effort matters — without it, a model's max and low runs read
// as a contradiction between sources.
//
// UPDATE 2026-08-05: this now fails. It was report-only on the reasoning above, and the reasoning
// was wrong in a way that cost this project a wrong number on the live site for days. When the
// catalog merged DeepSeek V4 Flash's preview and its post-trained 0731 release into one record,
// this check printed `deepseek-v4-flash/critpt: 7.14 vs 16.57` every single day and nothing
// happened, because a line that never fails is a line nobody reads. The disagreement was not
// research to be resolved — it was two different models in one cell, which rule 4 forbids.
//
// A genuine disagreement is still allowed, but it has to be written down: add an entry to
// `acknowledgedDisagreements` in data/model-aliases.json naming the cell and why the two sources
// differ. That is the same shape as `allowVariant` on an alias — the exception is cheap, and
// having to type a reason is what stops it from being reflexive.
const acknowledged = new Map(
  (aliasConfig.acknowledgedDisagreements ?? []).map((entry) => [`${entry.modelId}/${entry.benchmark}`, entry]),
);
const disagreements = [];
const unacknowledged = [];
for (const [modelId, cells] of Object.entries(OBSERVATIONS_BY_CELL)) {
  for (const [benchmarkId, variants] of Object.entries(cells)) {
    const byConfiguration = new Map();
    for (const row of variants) {
      const key = `${row.harness ?? "-"}|${row.reasoningEffort ?? "-"}`;
      (byConfiguration.get(key) ?? byConfiguration.set(key, []).get(key)).push(row);
    }
    for (const [configuration, rows] of byConfiguration) {
      // Deliberately not requiring two different sourceIds: the same source read twice —
      // once by script, once by eye — disagreeing is the most interesting case of all.
      if (rows.length < 2) continue;
      const low = Math.min(...rows.map((row) => row.score));
      const high = Math.max(...rows.map((row) => row.score));
      if (high - low <= 0.2 * Math.max(high, 1)) continue;
      const line =
        `${modelId}/${benchmarkId} [${configuration}]: ${low} vs ${high} — ` +
        [...new Set(rows.map((row) => row.sourceLabel))].join(" | ");
      const note = acknowledged.get(`${modelId}/${benchmarkId}`);
      if (note) disagreements.push(`${line} — acknowledged: ${note.reason}`);
      else unacknowledged.push(line);
    }
  }
}

// One board, one model, one cell. A source that publishes two entries thinks they are two
// models; if the catalog maps both to one record they collide, and the reader sees a cell whose
// primary was chosen by source precedence between two different products.
//
// This is the check that would have caught the DeepSeek V4 Flash merge on its own, and it catches
// the case the disagreement gate cannot: two models whose scores happen to agree. Keyed on
// harness and effort because a board legitimately publishes one row per operating point, and on
// the batch file because two *different* sources naming the same model differently is exactly
// what the alias table is for.
{
  const { resolveModelId, isDropped } = buildResolvers(aliasConfig);
  const exempt = new Set((aliasConfig.mergedInOneSource ?? []).map((entry) => `${entry.file}|${entry.modelId}`));
  const { batches } = readArchiveFiles();
  for (const { file, rows } of batches) {
    const byCell = new Map();
    for (const { raw } of rows) {
      if (!raw.benchmark || isDropped(raw.benchmark)) continue;
      const modelId = resolveModelId(raw.model_raw, raw.reasoning_effort, file);
      if (!modelId) continue;
      const key = `${modelId}|${raw.benchmark}|${raw.harness ?? "-"}|${raw.reasoning_effort ?? "-"}`;
      (byCell.get(key) ?? byCell.set(key, new Set()).get(key)).add(raw.model_raw);
    }
    const reported = new Set();
    for (const [key, strings] of byCell) {
      if (strings.size < 2) continue;
      const [modelId] = key.split("|");
      if (exempt.has(`${file.replace(/\.jsonl$/, "")}|${modelId}`) || reported.has(modelId)) continue;
      reported.add(modelId);
      errors.push(
        `${file}: ${[...strings].map((name) => `"${name}"`).join(" and ")} both resolve to ` +
        `${modelId} in one cell (${key.split("|").slice(1).join(" / ")}).\n  One source publishing ` +
        `two entries is one source saying they are two models. If they really are one, add ` +
        `{ file, modelId, reason } to mergedInOneSource in data/model-aliases.json; if they are ` +
        `not, one of the strings needs its own catalog record or no alias at all.`,
      );
    }
  }
}

for (const entry of unacknowledged.sort()) {
  errors.push(
    `${entry}\n  Two sources disagree by more than 20% about one configuration. Either they are ` +
    `measuring different things — in which case say so in acknowledgedDisagreements — or two ` +
    `models are sharing a cell, which is how a preview release once published its scores under ` +
    `the name of the model that replaced it.`,
  );
}

if (errors.length) {
  console.error("Model data contract failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const filledCells = Object.values(OBSERVATIONS_BY_CELL).reduce((total, cells) => total + Object.keys(cells).length, 0);
const totalCells = MODELS.length * BENCHMARKS.length;
const byKind = OBSERVATION_ROWS.reduce((counts, row) => ({ ...counts, [row.sourceKind]: (counts[row.sourceKind] ?? 0) + 1 }), {});

if (disagreements.length) {
  console.log(
    `\n${disagreements.length} acknowledged disagreement(s) — each has a written reason in ` +
      "data/model-aliases.json:",
  );
  for (const entry of disagreements.sort()) console.log(`  ${entry}`);
  console.log("");
}

console.log(
  `Model data contract passed: ${MODELS.length} models, ${BENCHMARKS.length} benchmarks, ` +
    `${OBSERVATION_ROWS.length} observations across ${filledCells}/${totalCells} cells ` +
    `(${((100 * filledCells) / totalCells).toFixed(1)}% cell coverage; ` +
    `benchmark ${byKind.benchmark ?? 0} / independent ${byKind.independent ?? 0} / vendor ${byKind.vendor ?? 0}).`,
);
