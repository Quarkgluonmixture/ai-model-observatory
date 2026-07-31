// Turns the raw transcription archive in data/sources/*.jsonl into typed observation rows.
//
// The archive is append-only evidence and is never edited to fit the catalog. Everything
// editorial - which published model string is which catalog model, which source class a
// page belongs to - lives in data/model-aliases.json so it can be reviewed on its own.
//
// A row that has no alias is skipped and reported. It is not guessed into place, and it
// stays in the archive so it can be ingested later when the catalog gains that model.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCE_DIR = join(ROOT, "data/sources");
const OUTPUT = join(ROOT, "app/observations.generated.ts");

const config = JSON.parse(readFileSync(join(ROOT, "data/model-aliases.json"), "utf8"));

const aliasKey = (modelRaw, effort) => `${modelRaw}|${effort ?? "null"}`;
const aliasIndex = new Map();
const wildcardIndex = new Map();
for (const alias of config.aliases) {
  if (alias.effort === "*") wildcardIndex.set(alias.modelRaw, alias.modelId);
  else aliasIndex.set(aliasKey(alias.modelRaw, alias.effort), alias.modelId);
}

const kindOverrides = new Map(config.sourceKindOverrides.map((entry) => [entry.sourceUrl, entry.sourceKind]));

// A published "version" that is really a different problem set gets its own benchmark id,
// so one table column never mixes two difficulty levels.
const splits = new Map(config.benchmarkSplits.map((entry) => [`${entry.benchmark}|${entry.benchmarkVersion}`, entry.benchmarkId]));
// Same version, different spelling across sources.
const versionAliases = new Map(config.versionAliases.map((entry) => [`${entry.benchmark}|${entry.from}`, entry.to]));
// An evaluator's own name for a benchmark the catalog already tracks.
const benchmarkAliases = new Map((config.benchmarkAliases ?? []).map((entry) => [entry.benchmark, entry.benchmarkId]));
// Transcribed benchmarks the dashboard deliberately does not carry, each with a reason.
const droppedBenchmarks = new Map((config.droppedBenchmarks ?? []).flatMap((entry) =>
  entry.benchmark.split("/").map((name) => [name.trim().replace(/\*$/, ""), entry.reason]),
));
// Benchmarks whose source publishes no version label, where we own the column outright.
const versionFallbacks = new Map((config.versionFallbacks ?? []).flatMap((entry) =>
  entry.benchmarks.map((name) => [name, entry.version]),
));
const isDropped = (benchmark) =>
  droppedBenchmarks.has(benchmark) ||
  [...droppedBenchmarks.keys()].some((key) => key.endsWith("-") && benchmark.startsWith(key));

const slug = (value) =>
  value.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

const rows = [];
const skipped = [];
const dropped = [];
const files = readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".jsonl")).sort();

for (const file of files) {
  const metaPath = join(SOURCE_DIR, file.replace(/\.jsonl$/, ".meta.json"));
  let meta = {};
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
  } catch {
    throw new Error(`${file} has no sidecar .meta.json; a batch must record when it was retrieved`);
  }

  // Some batches carry model operating parameters, not observations. They live in the same
  // archive for provenance but must never reach the observation store.
  if (meta.schema?.startsWith("Model operating parameters")) {
    console.log(`Skipping ${file}: ${meta.batch} holds model parameters, not observations.`);
    continue;
  }

  const lines = readFileSync(join(SOURCE_DIR, file), "utf8").split("\n").filter((line) => line.trim());
  for (const [index, line] of lines.entries()) {
    const raw = JSON.parse(line);

    if (isDropped(raw.benchmark)) {
      dropped.push(raw.benchmark);
      continue;
    }

    const modelId = aliasIndex.get(aliasKey(raw.model_raw, raw.reasoning_effort)) ?? wildcardIndex.get(raw.model_raw);

    if (!modelId) {
      skipped.push({ file, line: index + 1, modelRaw: raw.model_raw, effort: raw.reasoning_effort, benchmark: raw.benchmark });
      continue;
    }

    const fallbackVersion = versionFallbacks.get(benchmarkAliases.get(raw.benchmark) ?? raw.benchmark);
    if (!raw.benchmark_version && !fallbackVersion) {
      skipped.push({ file, line: index + 1, modelRaw: raw.model_raw, effort: raw.reasoning_effort, benchmark: raw.benchmark, reason: "no published benchmark version" });
      continue;
    }

    const canonical = benchmarkAliases.get(raw.benchmark) ?? raw.benchmark;
    const benchmarkId = splits.get(`${canonical}|${raw.benchmark_version}`) ?? canonical;

    const publishedVersion = raw.benchmark_version ?? fallbackVersion;
    const benchmarkVersion = versionAliases.get(`${canonical}|${publishedVersion}`) ?? publishedVersion;

    // Some sources put the tool list where a boolean belongs ("Exa", "lean_run_code; ...").
    // A named tool means tools were on; keep the names in the note rather than dropping them.
    const toolsNamed = typeof raw.tools_enabled === "string" ? raw.tools_enabled : null;
    const toolsEnabled = toolsNamed ? true : (raw.tools_enabled ?? null);
    const note = [raw.note, toolsNamed && `tools: ${toolsNamed}`].filter(Boolean).join("; ") || undefined;

    rows.push({
      modelId,
      benchmarkId,
      score: raw.score,
      sourceId: slug(raw.source_url),
      sourceLabel: raw.source_label,
      sourceUrl: raw.source_url,
      sourceKind: kindOverrides.get(raw.source_url) ?? raw.source_kind,
      benchmarkVersion,
      evaluationDate: raw.evaluation_date,
      retrievedDate: meta.retrievedDate,
      harness: raw.harness,
      reasoningEffort: raw.reasoning_effort,
      toolsEnabled,
      contextLength: raw.context_length ?? undefined,
      note,
    });
  }
}

const literal = (value) => (value === undefined ? undefined : JSON.stringify(value));
const serialise = (row) =>
  "  { " +
  Object.entries(row)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${literal(value)}`)
    .join(", ") +
  " }";

writeFileSync(
  OUTPUT,
  [
    "// GENERATED FILE - do not edit by hand.",
    "// Run `npm run ingest` to rebuild from data/sources/*.jsonl and data/model-aliases.json.",
    "",
    'import type { ObservationRow } from "./model-data";',
    "",
    "export const INGESTED_ROWS: ObservationRow[] = [",
    ...rows.map((row) => serialise(row) + ","),
    "];",
    "",
  ].join("\n"),
);

const bySource = rows.reduce((counts, row) => ({ ...counts, [row.sourceKind]: (counts[row.sourceKind] ?? 0) + 1 }), {});
console.log(`Ingested ${rows.length} rows from ${files.length} batch file(s) into app/observations.generated.ts`);
console.log(`  by source class: benchmark ${bySource.benchmark ?? 0} / independent ${bySource.independent ?? 0} / vendor ${bySource.vendor ?? 0}`);

if (dropped.length) {
  const counts = dropped.reduce((acc, name) => ({ ...acc, [name]: (acc[name] ?? 0) + 1 }), {});
  console.log("\nDeliberately not carried (see droppedBenchmarks in data/model-aliases.json):");
  for (const [name, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)} x ${name}`);
  }
}

if (skipped.length) {
  const grouped = new Map();
  for (const entry of skipped) {
    const key = `${entry.modelRaw} (${entry.effort ?? "no effort"})${entry.reason ? ` - ${entry.reason}` : ""}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  console.log(`\n${skipped.length} archived rows not ingested (no alias, kept for later):`);
  for (const [key, count] of [...grouped].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(3)} x ${key}`);
  }
}
