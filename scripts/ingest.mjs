// Turns the raw transcription archive in data/sources/*.jsonl into typed observation rows.
//
// The archive is append-only evidence and is never edited to fit the catalog. Everything
// editorial - which published model string is which catalog model, which source class a
// page belongs to - lives in data/model-aliases.json so it can be reviewed on its own.
//
// A row that has no alias is skipped and reported. It is not guessed into place, and it
// stays in the archive so it can be ingested later when the catalog gains that model.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildResolvers, loadAliasConfig, readArchiveFiles } from "./lib/archive.mjs";

// fileURLToPath, not .pathname: on Windows a file URL's pathname is "/C:/..." — a
// leading slash that fs cannot resolve. The agent maintaining this runs there.
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT = join(ROOT, "app/observations.generated.ts");

const config = loadAliasConfig();
// Alias resolution and the dropped-benchmark rule are shared with scripts/report-gaps.mjs,
// which has to agree with ingestion about which rows the catalog can accept.
const { resolveModelId, isDropped, supersededBy } = buildResolvers(config);

const kindOverrides = new Map(config.sourceKindOverrides.map((entry) => [entry.sourceUrl, entry.sourceKind]));

// A published "version" that is really a different problem set gets its own benchmark id,
// so one table column never mixes two difficulty levels.
const splits = new Map(config.benchmarkSplits.map((entry) => [`${entry.benchmark}|${entry.benchmarkVersion}`, entry.benchmarkId]));
// Same version, different spelling across sources.
const versionAliases = new Map(config.versionAliases.map((entry) => [`${entry.benchmark}|${entry.from}`, entry.to]));
// An evaluator's own name for a benchmark the catalog already tracks.
const benchmarkAliases = new Map((config.benchmarkAliases ?? []).map((entry) => [entry.benchmark, entry.benchmarkId]));
// Benchmarks whose source publishes no version label, where we own the column outright.
const versionFallbacks = new Map((config.versionFallbacks ?? []).flatMap((entry) =>
  entry.benchmarks.map((name) => [name, entry.version]),
));

const slug = (value) =>
  value.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

const rows = [];
const skipped = [];
const dropped = [];
const replaced = [];
const { batches, parameterBatches, fileCount } = readArchiveFiles();

// Some batches carry model operating parameters, not observations. They live in the same
// archive for provenance but must never reach the observation store.
for (const batch of parameterBatches) {
  console.log(`Skipping ${batch.file}: ${batch.meta.batch} holds model parameters, not observations.`);
}

for (const { file, meta, rows: lines } of batches) {
  for (const { line, raw } of lines) {
    if (isDropped(raw.benchmark)) {
      dropped.push(raw.benchmark);
      continue;
    }

    const replacedBy = supersededBy(file, raw.benchmark, raw.benchmark_version);
    if (replacedBy) {
      replaced.push(`${file} ${raw.benchmark} -> ${replacedBy}`);
      continue;
    }

    const modelId = resolveModelId(raw.model_raw, raw.reasoning_effort, file);

    if (!modelId) {
      skipped.push({ file, line, modelRaw: raw.model_raw, effort: raw.reasoning_effort, benchmark: raw.benchmark });
      continue;
    }

    const fallbackVersion = versionFallbacks.get(benchmarkAliases.get(raw.benchmark) ?? raw.benchmark);
    if (!raw.benchmark_version && !fallbackVersion) {
      skipped.push({ file, line, modelRaw: raw.model_raw, effort: raw.reasoning_effort, benchmark: raw.benchmark, reason: "no published benchmark version" });
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

// Arena Elo is derived here rather than hand-carried on the catalog record, and the reason is the
// shape of the number rather than tidiness. Elo moves continuously — every vote nudges it — so a
// value typed into app/model-data.ts is stale the day after it is typed, and a daily refresh of it
// would put `check:models` in permanent disagreement with the catalog, which is exactly why
// Artificial Analysis is excluded from the daily job. Deriving it removes the conflict: the archive
// is the only place the number lives, the catalog reads whatever the newest row says, and there is
// nothing left for an audit to disagree with.
//
// It also fixes an older wart. Arena publishes no per-effort boards, so an Elo was never a property
// of a configuration; it sat on one because that is where the field was. It is a family-level fact
// and now lives at family level.
//
// Two rules, and the second one was learned by getting it wrong. Newest retrieval wins — the same
// board re-read a week later is the same measurement with more votes behind it. But the archive
// carries a row PER OPERATING POINT (`claude-opus-5-max` at 1495, `claude-opus-5-high` at 1493),
// so rows also have to stay keyed by effort. Collapsing them to one row per model made "newest"
// decide between two rows retrieved on the same day, which silently picked whichever the file
// listed last and moved a published Elo by two points. The catalog picks the operating point; this
// only supplies the numbers.
const eloRows = [];
for (const { meta, rows: lines } of parameterBatches) {
  for (const { raw } of lines) {
    if (raw.text_elo == null && raw.code_elo == null) continue;
    const modelId = resolveModelId(raw.model_raw, raw.effort ?? null);
    if (!modelId) continue;
    eloRows.push({
      modelId,
      effort: raw.effort ?? null,
      textElo: raw.text_elo ?? null,
      codeElo: raw.code_elo ?? null,
      sourceLabel: raw.source_label,
      sourceUrl: raw.source_url,
      retrievedDate: meta.retrievedDate,
      evaluationDate: raw.evaluation_date ?? null,
    });
  }
}
eloRows.sort((a, b) => String(a.retrievedDate).localeCompare(String(b.retrievedDate)));

const elo = new Map();
for (const row of eloRows) {
  const key = `${row.modelId}|${row.effort ?? ""}`;
  const current = elo.get(key) ?? { modelId: row.modelId, effort: row.effort, textElo: null, codeElo: null };
  // Each field takes the newest row that actually carries it: a source that publishes only a text
  // Elo must not blank out a code Elo somebody else published.
  if (row.textElo != null) {
    Object.assign(current, { textElo: row.textElo, textSource: row.sourceLabel, textUrl: row.sourceUrl, textRetrieved: row.retrievedDate, textEvaluated: row.evaluationDate });
  }
  if (row.codeElo != null) {
    Object.assign(current, { codeElo: row.codeElo, codeSource: row.sourceLabel, codeUrl: row.sourceUrl, codeRetrieved: row.retrievedDate, codeEvaluated: row.evaluationDate });
  }
  elo.set(key, current);
}
const eloEntries = [...elo.values()].sort((a, b) => a.modelId.localeCompare(b.modelId) || String(a.effort).localeCompare(String(b.effort)));

writeFileSync(
  OUTPUT,
  [
    "// GENERATED FILE - do not edit by hand.",
    "// Run `npm run ingest` to rebuild from data/sources/*.jsonl and data/model-aliases.json.",
    "",
    'import type { ArenaElo, ObservationRow } from "./model-data";',
    "",
    "export const INGESTED_ROWS: ObservationRow[] = [",
    ...rows.map((row) => serialise(row) + ","),
    "];",
    "",
    "// Human-preference Elo, keyed by catalog model id. Derived, never typed: see scripts/ingest.mjs.",
    "export const ARENA_ELO: ArenaElo[] = [",
    ...eloEntries.map((row) => serialise(row) + ","),
    "];",
    "",
  ].join("\n"),
);

const bySource = rows.reduce((counts, row) => ({ ...counts, [row.sourceKind]: (counts[row.sourceKind] ?? 0) + 1 }), {});
console.log(`Ingested ${rows.length} rows from ${fileCount} batch file(s) into app/observations.generated.ts`);
console.log(`  by source class: benchmark ${bySource.benchmark ?? 0} / independent ${bySource.independent ?? 0} / vendor ${bySource.vendor ?? 0}`);
console.log(`  Arena Elo derived for ${new Set(eloEntries.map((e) => e.modelId)).size} model(s) across ${eloEntries.length} operating point(s)`);

if (dropped.length) {
  const counts = dropped.reduce((acc, name) => ({ ...acc, [name]: (acc[name] ?? 0) + 1 }), {});
  console.log("\nDeliberately not carried (see droppedBenchmarks in data/model-aliases.json):");
  for (const [name, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)} x ${name}`);
  }
}

if (replaced.length) {
  const counts = replaced.reduce((acc, name) => ({ ...acc, [name]: (acc[name] ?? 0) + 1 }), {});
  console.log("\nSuperseded by a scripted fetch of the same page (see supersededRows):");
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
