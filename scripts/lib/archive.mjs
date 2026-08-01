// Shared archive access for the scripts that read data/sources/*.jsonl.
//
// Ingestion and the gap report ask the same two questions of the archive — which published
// model string is which catalog model, and which benchmarks are deliberately not carried —
// so the answers live here once. A second copy of this logic would drift, and it would drift
// silently: both callers would keep producing plausible output while disagreeing about which
// rows the catalog can actually accept.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname: on Windows a file URL's pathname is "/C:/..." — a
// leading slash that fs cannot resolve. The agent maintaining this runs there.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const SOURCE_DIR = join(ROOT, "data/sources");
export const ALIAS_FILE = join(ROOT, "data/model-aliases.json");

export const loadAliasConfig = () => JSON.parse(readFileSync(ALIAS_FILE, "utf8"));

const aliasKey = (modelRaw, effort) => `${modelRaw}|${effort ?? "null"}`;

/**
 * Turns the alias file into the two lookups ingestion needs. A row with no alias is not
 * guessed into place, so both callers must treat an undefined result as "skip and report".
 */
export const buildResolvers = (config) => {
  const aliasIndex = new Map();
  const wildcardIndex = new Map();
  for (const alias of config.aliases) {
    if (alias.effort === "*") wildcardIndex.set(alias.modelRaw, alias.modelId);
    else aliasIndex.set(aliasKey(alias.modelRaw, alias.effort), alias.modelId);
  }

  // Transcribed benchmarks the dashboard deliberately does not carry, each with a reason.
  const droppedBenchmarks = new Map((config.droppedBenchmarks ?? []).flatMap((entry) =>
    entry.benchmark.split("/").map((name) => [name.trim().replace(/\*$/, ""), entry.reason]),
  ));

  // A transcription that a scripted fetch later read faithfully from the same page. Both are
  // real evidence and both stay in the archive, but only one may be ingested: they are one
  // measurement read twice, and two rows in one cell would let the rounded reading compete
  // with the exact one. The judgement lives here rather than in the archive, which is
  // append-only, and rather than in code, where it would have no stated reason.
  // `benchmarkVersion` matters: batch 02 transcribed Terminal-Bench 2.0 and 2.1 under one
  // benchmark name, and only the 2.1 rows have a scripted replacement. Superseding on the name
  // alone would silently delete the 2.0 column.
  const superseded = (config.supersededRows ?? []).map((entry) => ({
    file: entry.file,
    benchmark: entry.benchmark ?? null,
    benchmarkVersion: entry.benchmarkVersion ?? null,
    supersededBy: entry.supersededBy,
  }));

  return {
    resolveModelId: (modelRaw, effort) =>
      aliasIndex.get(aliasKey(modelRaw, effort)) ?? wildcardIndex.get(modelRaw),
    isDropped: (benchmark) =>
      droppedBenchmarks.has(benchmark) ||
      [...droppedBenchmarks.keys()].some((key) => key.endsWith("-") && benchmark.startsWith(key)),
    /** The batch that replaced this row, or null if nothing has. */
    supersededBy: (file, benchmark, benchmarkVersion) =>
      superseded.find((entry) =>
        file.replace(/\.jsonl$/, "") === entry.file &&
        (entry.benchmark === null || entry.benchmark === benchmark) &&
        (entry.benchmarkVersion === null || entry.benchmarkVersion === benchmarkVersion),
      )?.supersededBy ?? null,
    droppedBenchmarks,
  };
};

/**
 * Reads every batch with its sidecar meta. `parameterBatches` carry model operating
 * parameters rather than observations: they live in the archive for provenance and must
 * never reach the observation store.
 */
export const readArchiveFiles = () => {
  const batches = [];
  const parameterBatches = [];
  const files = readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".jsonl")).sort();

  for (const file of files) {
    const metaPath = join(SOURCE_DIR, file.replace(/\.jsonl$/, ".meta.json"));
    let meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch {
      throw new Error(`${file} has no sidecar .meta.json; a batch must record when it was retrieved`);
    }

    const target = meta.schema?.startsWith("Model operating parameters") ? parameterBatches : batches;
    target.push({
      file,
      meta,
      rows: readFileSync(join(SOURCE_DIR, file), "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line, index) => ({ line: index + 1, raw: JSON.parse(line) })),
    });
  }

  return { batches, parameterBatches, fileCount: files.length };
};
