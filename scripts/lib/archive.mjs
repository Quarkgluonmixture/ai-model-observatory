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
  // An alias may name the batch file it applies to, because one published model string does not
  // always mean one model. `deepseek-v4-flash` is the post-trained 0731 release on Artificial
  // Analysis, which kept its slug when the model was re-trained, and the earlier preview on
  // LiveBench, Epoch and LMArena, all of which print `deepseek-v4-flash-0731` for the official
  // one. Effort cannot separate them — on LiveBench both carry none — so the source has to.
  // A file-scoped entry wins over a global one; without this, whichever meaning was mapped
  // globally reported the other model's numbers under it, and nothing failed.
  for (const alias of config.aliases) {
    const scope = alias.file ? `${alias.file}|` : "";
    if (alias.effort === "*") wildcardIndex.set(scope + alias.modelRaw, alias.modelId);
    else aliasIndex.set(scope + aliasKey(alias.modelRaw, alias.effort), alias.modelId);
  }

  // Transcribed benchmarks the dashboard deliberately does not carry, each with a reason.
  // `benchmark` is a "/"-separated list, which cannot express a published label that contains a
  // slash — and they exist: "HLE-VL (w/ Tools)", "OCR-Bench-V2 (EN/ZH)", "VideoMME (w/ Sub.)".
  // Split on "/" those become fragments matching nothing, so the rows stay live and land in
  // ingest as unknown benchmark ids. `benchmarks` takes an array and is exact.
  const droppedBenchmarks = new Map((config.droppedBenchmarks ?? []).flatMap((entry) =>
    (entry.benchmarks ?? entry.benchmark.split("/")).map((name) => [name.trim().replace(/\*$/, ""), entry.reason]),
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
    field: entry.field ?? null,
    modelRaw: entry.modelRaw ?? null,
    supersededBy: entry.supersededBy,
  }));

  return {
    /**
     * `file` is optional; pass it and a file-scoped alias is preferred over the global one.
     * A scoped entry with `"modelId": null` is a deliberate refusal — the string resolves
     * globally but must not resolve *here*, which is how a vendor's table of its competitors'
     * scores stays archived without being ingested. `has` rather than `??`, because the whole
     * point of such an entry is that its value is empty.
     */
    resolveModelId: (modelRaw, effort, file) => {
      const scope = file ? `${String(file).replace(/\.jsonl$/, "")}|` : null;
      if (scope) {
        const exact = scope + aliasKey(modelRaw, effort);
        if (aliasIndex.has(exact)) return aliasIndex.get(exact) ?? undefined;
        if (wildcardIndex.has(scope + modelRaw)) return wildcardIndex.get(scope + modelRaw) ?? undefined;
      }
      return aliasIndex.get(aliasKey(modelRaw, effort)) ?? wildcardIndex.get(modelRaw);
    },
    /**
     * True when this file deliberately refuses the string, rather than the catalog simply not
     * holding the model. The gap report must not list a refusal as "waiting on a catalog model":
     * the model is in the catalog, the decision was to not take these rows.
     */
    isRefused: (modelRaw, effort, file) => {
      if (!file) return false;
      const scope = `${String(file).replace(/\.jsonl$/, "")}|`;
      const exact = scope + aliasKey(modelRaw, effort);
      if (aliasIndex.has(exact)) return aliasIndex.get(exact) == null;
      if (wildcardIndex.has(scope + modelRaw)) return wildcardIndex.get(scope + modelRaw) == null;
      return false;
    },
    isDropped: (benchmark) =>
      droppedBenchmarks.has(benchmark) ||
      [...droppedBenchmarks.keys()].some((key) => key.endsWith("-") && benchmark.startsWith(key)),
    /** The batch that replaced this row (or field), or null if nothing has. */
    supersededBy: (file, benchmark, benchmarkVersion, field, modelRaw) =>
      superseded.find((entry) =>
        file.replace(/\.jsonl$/, "") === entry.file &&
        (entry.benchmark === null || entry.benchmark === benchmark) &&
        (entry.benchmarkVersion === null || entry.benchmarkVersion === benchmarkVersion) &&
        (entry.field === null || entry.field === field) &&
        (entry.modelRaw === null || entry.modelRaw === modelRaw),
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
