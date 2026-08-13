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

/**
 * When a row was MEASURED, for the record windows below — not when it was filed.
 *
 * Observation rows carry `evaluation_date` and answer for themselves. Parameter rows do not, and
 * that is the gap the windows were blind to: prices travel the parameter path, and a price is
 * exactly the kind of fact a maker changes under an unchanged slug.
 *
 * `retrievedDate` is the obvious substitute and is only sometimes valid, so the batch has to say
 * so rather than have it assumed. A price read off a vendor page on a date IS that date's price.
 * An Arena Elo is not: it is weeks of votes, and `batch-22-arena` happens to be stamped
 * 2026-08-12 — the day DeepSeek's GA went live at 15:42 UTC, hours after any vote in it. Assuming
 * the substitute everywhere would have refused that batch and deleted two published Elo (1458 text
 * / 1445 code) to guard against a mixup that had not happened. Measured before it was written, not
 * after it broke.
 *
 * Default is null, i.e. undated, i.e. the behaviour before windows existed. A batch opts in.
 */
export const measurementDateOf = (raw, meta) =>
  raw?.evaluation_date ?? (meta?.retrievedDateIsMeasurement ? meta.retrievedDate ?? null : null);

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

  // A measurement window on the RECORD, not on the alias. File scope answers "which board is
  // this?"; this answers "when was it measured?", and they are different questions because a
  // maker can change what a slug serves without any board renaming anything. DeepSeek shipped V4
  // Pro as a preview in April and as `deepseek-v4-pro-0813` on 2026-08-12, and ten strings resolve
  // to the preview's record with `effort: "*"`. Nothing in file scope separates a June reading of
  // one of those slugs from a September one — board, string and effort are identical on both sides
  // and only the date differs. Unguarded, the GA numbers land on the preview's record and, per
  // GOTCHAS 24, land in cells the preview never filled, where no disagreement gate can see them.
  // That is the Flash accident with a delay fuse.
  //
  // Keyed by modelId rather than by alias because the cutover is ONE fact. Written per alias it
  // would be ten copies of a date, and — worse — the eleventh alias, the one the attribution gate
  // writes unattended next week, would be born unguarded. A record that stops accepting readings
  // after a date says so once, and every route into it inherits that.
  //
  // `validUntil` is EXCLUSIVE and compared as an ISO date string, which sorts correctly.
  //
  // An undated row counts as in-window, and that is a deliberate hole rather than an oversight:
  // 38 of the 73 rows published under a bare V4 Pro string carry no `evaluation_date` at all, so
  // failing closed on null would drop half the existing evidence today to guard against rows that
  // do not exist yet. The guard covers every source that dates its rows and misses every source
  // that does not. Narrowing it means getting dates onto those rows, not tightening this test.
  const windows = new Map((config.modelWindows ?? []).map((entry) => [entry.modelId, entry]));
  const inWindow = (modelId, evaluationDate) => {
    const window = windows.get(modelId);
    if (!window || !evaluationDate) return true;
    if (window.validFrom && evaluationDate < window.validFrom) return false;
    if (window.validUntil && evaluationDate >= window.validUntil) return false;
    return true;
  };

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
    resolveModelId: (modelRaw, effort, file, evaluationDate) => {
      // Resolution is unchanged; the window is applied to whatever it produced. Written as a
      // wrapper on the existing lookup rather than woven into it so that a row leaving the
      // catalog is always a window decision and never an accident of lookup order.
      const resolved = (() => {
        const scope = file ? `${String(file).replace(/\.jsonl$/, "")}|` : null;
        if (scope) {
          const exact = scope + aliasKey(modelRaw, effort);
          if (aliasIndex.has(exact)) return aliasIndex.get(exact) ?? undefined;
          if (wildcardIndex.has(scope + modelRaw)) return wildcardIndex.get(scope + modelRaw) ?? undefined;
        }
        return aliasIndex.get(aliasKey(modelRaw, effort)) ?? wildcardIndex.get(modelRaw);
      })();
      if (resolved && !inWindow(resolved, evaluationDate)) return undefined;
      return resolved;
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

// ---------------------------------------------------------------- self-test
//
//   node scripts/lib/archive.mjs --self-test
//
// A measurement window is a guard whose whole value is in a future it is supposed to prevent, so
// on today's archive it is indistinguishable from having done nothing: `npm run ingest` writes a
// byte-identical file with it in place, which is the point and also the problem. Three directions
// are asserted instead, against the real alias config rather than a fixture, because the thing
// most likely to break this is somebody editing that config.
//
// The third assertion pins the hole deliberately. An undated row still resolves, and a future
// reader who tightens that will drop half of this record's evidence — so it fails here as a
// changed decision rather than passing quietly as a stricter rule.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[/\\]/, "")) && process.argv.includes("--self-test")) {
  const config = loadAliasConfig();
  const { resolveModelId } = buildResolvers(config);
  const window = (config.modelWindows ?? []).find((entry) => entry.modelId === "deepseek-v4-pro");
  const failures = [];
  if (!window?.validUntil) failures.push("no measurement window on deepseek-v4-pro — the GA guard is not configured");

  const cases = window?.validUntil
    ? [
        ["a reading from before the GA date resolves", "DeepSeek V4 Pro", "2026-08-06", "deepseek-v4-pro"],
        ["a reading dated ON the GA date is refused", "DeepSeek V4 Pro", window.validUntil, undefined],
        ["a reading from after the GA date is refused", "deepseek-v4-pro", "2026-09-01", undefined],
        ["an UNDATED reading still resolves (the documented hole)", "deepseek-v4-pro", null, "deepseek-v4-pro"],
        ["an unwindowed record is untouched by any date", "Claude Opus 5", "2026-09-01", "claude-opus-5"],
      ]
    : [];
  for (const [label, raw, date, expected] of cases) {
    const got = resolveModelId(raw, "*", null, date);
    console.log(`  ${got === expected ? "ok  " : "FAIL"} ${label} → ${got ?? "unmapped"}`);
    if (got !== expected) failures.push(`${label}: expected ${expected ?? "unmapped"}, got ${got ?? "unmapped"}`);
  }

  // The parameter path, which is where prices travel and where the window was blind until
  // 2026-08-13. A parameter row has no `evaluation_date`, so everything here turns on whether the
  // batch declared that its retrieval dates its rows.
  const paramCases = [
    ["a declaring batch fetched before the GA date still resolves", { retrievedDateIsMeasurement: true, retrievedDate: "2026-08-11" }, "deepseek-v4-pro"],
    ["a declaring batch refetched after it is refused", { retrievedDateIsMeasurement: true, retrievedDate: "2026-08-20" }, undefined],
    ["a NON-declaring batch is untouched, however late", { retrievedDate: "2026-08-20" }, "deepseek-v4-pro"],
  ];
  for (const [label, meta, expected] of paramCases) {
    const got = resolveModelId("deepseek-v4-pro", "*", null, measurementDateOf({}, meta));
    console.log(`  ${got === expected ? "ok  " : "FAIL"} ${label} → ${got ?? "unmapped"}`);
    if (got !== expected) failures.push(`${label}: expected ${expected ?? "unmapped"}, got ${got ?? "unmapped"}`);
  }

  // Arena must be the batch that does NOT declare: it is stamped 2026-08-12, the day the GA went
  // live hours later, and it supplies deepseek-v4-pro's published Elo. Declaring it would delete
  // two real numbers to guard against a mixup that had not happened.
  const arena = JSON.parse(readFileSync(join(SOURCE_DIR, "batch-22-arena.meta.json"), "utf8"));
  if (arena.retrievedDateIsMeasurement) {
    failures.push("batch-22-arena declares its retrieval dates its rows — an Elo is accumulated votes, and this drops published numbers");
  } else {
    console.log("  ok   batch-22-arena does not claim its retrieval dates its rows");
  }
  console.log(failures.length ? "self-test FAILED" : "self-test passed");
  process.exit(failures.length ? 1 : 0);
}

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
