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

  // A measurement window on the RECORD, not on the alias: file scope answers "which board is this?",
  // this answers "when was it measured?", and a maker can change what a slug serves without any board
  // renaming anything.
  //
  // ⚠ `modelWindows` is EMPTY as of 2026-08-19 and the mechanism is kept, not retired. It was built for
  // `deepseek-v4-pro`, where ten strings resolved to the April preview with `effort: "*"` and DeepSeek
  // shipped `deepseek-v4-pro-0813` under the same family name — the Flash accident with a delay fuse.
  // It did its job: no GA reading ever landed on the preview's record. When the record was flipped to
  // the GA, the guard was replaced by a STRING guard rather than inverted, and the reason is worth
  // keeping because it is the trap the obvious move walks into: LiveBench publishes BOTH spellings under
  // its frozen release date 2026-06-25, so `validFrom: "2026-08-12"` would have refused the GA's own 23
  // LiveBench cells. Dates cannot separate two models a board scored in the same release; the strings
  // it prints can, and every route into that record now carries `-0813` or is scoped to one batch file
  // with the number that identifies it written down.
  //
  // So the next record that needs this will be one where the sources do NOT split, which is where a date
  // is the only handle left. Two properties to inherit when that happens:
  //
  // `validUntil` is EXCLUSIVE and compared as an ISO date string, which sorts correctly.
  //
  // An undated row counts as in-window, and that was a deliberate hole rather than an oversight: 38 of
  // the 73 rows published under a bare V4 Pro string carried no `evaluation_date` at all, so failing
  // closed on null would have dropped half that record's evidence to guard against rows that did not
  // exist yet. A window covers every source that dates its rows and misses every source that does not.
  // Narrowing it means getting dates onto those rows, not tightening the comparison.
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
     * True when the catalog deliberately refuses the string, rather than simply not holding the
     * model. The gap report must not list a refusal as "waiting on a catalog model": the model is
     * in the catalog, the decision was to not take these rows.
     *
     * Two scopes, and the global one was added on 2026-08-19 when a refusal first needed to apply
     * everywhere. Ten bare `DeepSeek V4 Pro` spellings became `"modelId": null` with no `file` the
     * day that record became the GA release: the preview's rows stay archived and unignested, which
     * is a decision, and without this branch all 132 of them would have joined the gaps issue's
     * "waiting on a catalog model" list forever — the exact permanent, un-actionable line the
     * file-scoped branch below was written to prevent, arriving through the other door. A refusal is
     * a refusal whatever its scope; only its blast radius differs.
     *
     * `has` rather than `??` in both branches, because the whole point of such an entry is that its
     * value is empty, and absence of an entry is a different answer from an entry saying no.
     */
    isRefused: (modelRaw, effort, file) => {
      if (file) {
        const scope = `${String(file).replace(/\.jsonl$/, "")}|`;
        const exact = scope + aliasKey(modelRaw, effort);
        if (aliasIndex.has(exact)) return aliasIndex.get(exact) == null;
        if (wildcardIndex.has(scope + modelRaw)) return wildcardIndex.get(scope + modelRaw) == null;
      }
      const global = aliasKey(modelRaw, effort);
      if (aliasIndex.has(global)) return aliasIndex.get(global) == null;
      if (wildcardIndex.has(modelRaw)) return wildcardIndex.get(modelRaw) == null;
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
// What the DeepSeek V4 Pro guard asserts, and why it changed shape on 2026-08-19.
//
// Until then this record was the April PREVIEW and the guard was a measurement window
// (`validUntil: 2026-08-12`), because ten bare strings resolved here with `effort: "*"` and a GA
// reading arriving under an unchanged slug would have landed in cells the preview never filled,
// where no disagreement gate can see it. The record is now the GA release, and the guard is the
// STRING: bare spellings are refused globally with a written reason, `-0813` spellings resolve.
//
// The first case below is the one that makes this worth a test rather than a comment. Inverting the
// window to `validFrom: "2026-08-12"` is the obvious move and it is wrong: LiveBench publishes BOTH
// spellings under its frozen release date 2026-06-25, so a from-date would have refused the GA's own
// 23 LiveBench cells — the flip would have shipped a record with a third of its evidence deleted and
// every contract green. A date cannot separate two models one board scored in the same release.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[/\\]/, "")) && process.argv.includes("--self-test")) {
  const config = loadAliasConfig();
  const { resolveModelId, isRefused } = buildResolvers(config);
  const failures = [];
  const resolve = (raw, effort, file, date) => resolveModelId(raw, effort, file, date) ?? undefined;

  const cases = [
    // The trap. Both of these carry LiveBench's frozen release date, which predates the GA.
    ["the GA string resolves even dated BEFORE the GA (LiveBench's frozen release)", "deepseek-v4-pro-0813", "*", null, "2026-06-25", "deepseek-v4-pro"],
    ["the bare string is refused on that same date", "deepseek-v4-pro", "*", null, "2026-06-25", undefined],
    // Refusal is by string, so it does not depend on a date being present — the old window's
    // documented hole (an undated row resolved) is closed for this record.
    ["an UNDATED bare reading is refused too", "deepseek-v4-pro", "*", null, null, undefined],
    ["a bare reading from after the GA is refused", "DeepSeek V4 Pro", "*", null, "2026-09-01", undefined],
    ["Vals' provider-prefixed GA string resolves", "deepseek/deepseek-v4-pro-0813", "*", null, null, "deepseek-v4-pro"],
    ["Vals' provider-prefixed bare string is refused", "deepseek/deepseek-v4-pro", "*", null, null, undefined],
    // File scope is what carries the two sources that do NOT split the releases. Each one is a
    // number or a sentence in the source, written into the alias reason.
    ["DeepSWE's bare row resolves inside its own batch (62.8 = the GA's 62.7)", "deepseek-v4-pro", "*", "batch-11-deepswe", "2026-08-13", "deepseek-v4-pro"],
    ["the pricing page's bare column resolves inside its own batch", "deepseek-v4-pro", "*", "batch-33-deepseek-peak-pricing", "2026-08-16", "deepseek-v4-pro"],
    ["the same bare string in a THIRD batch stays refused", "deepseek-v4-pro", "*", "batch-26-aa-evaluations", null, undefined],
    ["an unrelated record is untouched", "Claude Opus 5", "*", null, "2026-09-01", "claude-opus-5"],
  ];
  for (const [label, raw, effort, file, date, expected] of cases) {
    const got = resolve(raw, effort, file, date);
    console.log(`  ${got === expected ? "ok  " : "FAIL"} ${label} → ${got ?? "unmapped"}`);
    if (got !== expected) failures.push(`${label}: expected ${expected ?? "unmapped"}, got ${got ?? "unmapped"}`);
  }

  // A global refusal must read as a DECISION, not as an uncollected model, or all 132 archived
  // preview rows join the gaps issue's "waiting on a catalog model" list every release.
  const refusalCases = [
    ["a globally refused string reports as refused", "deepseek-v4-pro", "*", "batch-26-aa-evaluations", true],
    ["a refusal is a refusal with no file in hand", "DeepSeek V4 Pro (Reasoning, Max Effort)", "*", undefined, true],
    ["a string nobody has ruled on is NOT a refusal", "some-model-nobody-mapped", "*", undefined, false],
    ["a mapped string is not a refusal", "deepseek-v4-pro-0813", "*", undefined, false],
  ];
  for (const [label, raw, effort, file, expected] of refusalCases) {
    const got = isRefused(raw, effort, file);
    console.log(`  ${got === expected ? "ok  " : "FAIL"} ${label} → ${got}`);
    if (got !== expected) failures.push(`${label}: expected ${expected}, got ${got}`);
  }

  // The window mechanism itself is now unused by every record (`modelWindows` is empty), and it is
  // kept rather than deleted: the next family whose sources do NOT split will have nothing but a
  // date to go on. Unused code rots silently, so it is exercised against a synthetic config here.
  // If a record ever takes a window again, assert it above against the real config as well.
  if ((config.modelWindows ?? []).length) {
    console.log(`  note  modelWindows is no longer empty (${config.modelWindows.map((w) => w.modelId).join(", ")}) — add real-config window cases above`);
  }
  const synthetic = buildResolvers({
    ...config,
    aliases: [{ modelRaw: "synthetic-window-probe", effort: "*", modelId: "claude-opus-5" }, ...config.aliases],
    modelWindows: [{ modelId: "claude-opus-5", validUntil: "2026-08-12", reason: "self-test only" }],
  });
  const windowCases = [
    ["mechanism: a reading before validUntil resolves", "2026-08-11", "claude-opus-5"],
    ["mechanism: a reading ON validUntil is refused (exclusive)", "2026-08-12", undefined],
    ["mechanism: an undated reading still resolves (the documented hole)", null, "claude-opus-5"],
  ];
  for (const [label, date, expected] of windowCases) {
    const got = synthetic.resolveModelId("synthetic-window-probe", "*", null, date) ?? undefined;
    console.log(`  ${got === expected ? "ok  " : "FAIL"} ${label} → ${got ?? "unmapped"}`);
    if (got !== expected) failures.push(`${label}: expected ${expected ?? "unmapped"}, got ${got ?? "unmapped"}`);
  }

  // The parameter path, which is where prices travel. A parameter row has no `evaluation_date`, so
  // everything here turns on whether the batch declared that its retrieval dates its rows — and
  // with the guard now on the string, the answer must be the same either way for this record.
  const paramCases = [
    ["a declaring batch's bare parameter row is still refused", { retrievedDateIsMeasurement: true, retrievedDate: "2026-08-11" }, undefined],
    ["a NON-declaring batch's bare parameter row is refused too", { retrievedDate: "2026-08-20" }, undefined],
  ];
  for (const [label, meta, expected] of paramCases) {
    const got = resolve("deepseek-v4-pro", "*", null, measurementDateOf({}, meta));
    console.log(`  ${got === expected ? "ok  " : "FAIL"} ${label} → ${got ?? "unmapped"}`);
    if (got !== expected) failures.push(`${label}: expected ${expected ?? "unmapped"}, got ${got ?? "unmapped"}`);
  }

  // Arena must be the batch that does NOT declare its retrieval dates its rows. The original reason
  // was that declaring it would have dropped this record's published Elo through the window; the
  // window is gone and the reason underneath it is not — an Elo is accumulated votes, so its
  // retrieval date is not a measurement date, and this batch is where that is easiest to get wrong.
  const arena = JSON.parse(readFileSync(join(SOURCE_DIR, "batch-22-arena.meta.json"), "utf8"));
  if (arena.retrievedDateIsMeasurement) {
    failures.push("batch-22-arena declares its retrieval dates its rows — an Elo is accumulated votes, and a retrieval date is not a measurement date");
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
