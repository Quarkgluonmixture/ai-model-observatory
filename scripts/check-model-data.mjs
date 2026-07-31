import {
  BENCHMARK_OBSERVATIONS,
  BENCHMARK_SCORES,
  BENCHMARKS,
  MODELS,
  OBSERVATION_ROWS,
  OBSERVATIONS_BY_CELL,
} from "../app/model-data.ts";

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

if (errors.length) {
  console.error("Model data contract failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const filledCells = Object.values(OBSERVATIONS_BY_CELL).reduce((total, cells) => total + Object.keys(cells).length, 0);
const totalCells = MODELS.length * BENCHMARKS.length;
const byKind = OBSERVATION_ROWS.reduce((counts, row) => ({ ...counts, [row.sourceKind]: (counts[row.sourceKind] ?? 0) + 1 }), {});

console.log(
  `Model data contract passed: ${MODELS.length} models, ${BENCHMARKS.length} benchmarks, ` +
    `${OBSERVATION_ROWS.length} observations across ${filledCells}/${totalCells} cells ` +
    `(${((100 * filledCells) / totalCells).toFixed(1)}% cell coverage; ` +
    `benchmark ${byKind.benchmark ?? 0} / independent ${byKind.independent ?? 0} / vendor ${byKind.vendor ?? 0}).`,
);
