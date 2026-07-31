import {
  BENCHMARK_OBSERVATIONS,
  BENCHMARK_SCORES,
  BENCHMARKS,
  MODELS,
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

for (const [modelId, observations] of Object.entries(BENCHMARK_OBSERVATIONS)) {
  if (!modelIds.has(modelId)) errors.push(`observations reference unknown model: ${modelId}`);

  for (const [benchmarkId, observation] of Object.entries(observations)) {
    if (!benchmarkIds.has(benchmarkId)) errors.push(`${modelId} references unknown benchmark: ${benchmarkId}`);
    if (!Number.isFinite(observation.score)) errors.push(`${modelId}/${benchmarkId} has a non-finite score`);
    if (!observation.sourceId || !observation.sourceLabel || !observation.sourceUrl) {
      errors.push(`${modelId}/${benchmarkId} is missing source provenance`);
    }
    if (!observation.benchmarkVersion || !observation.evaluationDate) {
      errors.push(`${modelId}/${benchmarkId} is missing version or evaluation date`);
    }

    const derivedScore = BENCHMARK_SCORES[modelId]?.[benchmarkId];
    if (derivedScore !== observation.score) {
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

if (errors.length) {
  console.error("Model data contract failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const observationCount = Object.values(BENCHMARK_OBSERVATIONS)
  .reduce((total, observations) => total + Object.keys(observations).length, 0);

console.log(`Model data contract passed: ${MODELS.length} models, ${BENCHMARKS.length} benchmarks, ${observationCount} observations.`);
