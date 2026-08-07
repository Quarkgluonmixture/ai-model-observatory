// How much of the archive is already waiting for a model the catalog does not carry yet.
//
// This answers one question — "if a record for this model existed, how many cells would it fill
// today?" — and it exists as a module rather than inside `scripts/report-gaps.mjs` because the
// answer is what decides whether a record should be written at all. Two callers need the same
// number and a second copy of it would drift into disagreeing with itself about which models are
// worth collecting.
//
// ## Why it counts UNALIASED strings, which looks like the wrong thing to count
//
// `check:models` exits 1 on an alias naming a catalog id that does not exist, so a record must be
// written before its aliases can be. For any model this is asked about, "rows already resolving to
// it" is therefore zero by construction, and a counter built on `resolveModelId` would report zero
// for everything forever. So the match is on the published string itself, normalised.
//
// ## Every number here is a LOWER bound, deliberately
//
// `norm` collapses case, spaces, dots, dashes, underscores and brackets — the same normalisation
// the attribution gate uses to decide two published strings are the same string. A source that
// spells a model differently enough to survive that is not counted. Measured against the catalog's
// own models (see `--self-test`), the counter recovers most of what each one actually carries and
// never overstates it, which is the safe direction for a number whose job is to stop an empty row:
// "under the floor" is a claim it can make, "over the floor" is a candidate for a reader.
//
// A benchmark NAME is also not a catalog column. The same three lookups `ingest.mjs` applies —
// dropped benchmarks, an evaluator's own name for a column, a version that gets its own id — are
// applied here, so a row against a benchmark this catalog does not carry is not counted as a cell
// it would fill.
//
//   node scripts/lib/upstream-evidence.mjs --self-test    # replay against the catalog's models

import { buildResolvers, loadAliasConfig, readArchiveFiles } from "./archive.mjs";

export const norm = (value) => String(value).toLowerCase().replace(/[\s._\-()]/g, "");

/**
 * Builds the index once. `benchmarks` is the catalog's own list of column ids, passed in rather
 * than imported so this module stays free of the TypeScript catalog and can be run by plain node.
 */
export const buildEvidenceIndex = (benchmarkIds) => {
  const config = loadAliasConfig();
  const { isDropped, supersededBy } = buildResolvers(config);
  const aliases = new Map((config.benchmarkAliases ?? []).map((e) => [e.benchmark, e.benchmarkId]));
  const splits = new Map((config.benchmarkSplits ?? []).map((e) => [`${e.benchmark}|${e.benchmarkVersion}`, e.benchmarkId]));
  const fallbacks = new Map((config.versionFallbacks ?? []).flatMap((e) => e.benchmarks.map((name) => [name, e.version])));
  const columns = new Set(benchmarkIds);

  // Three reasons a row exists and is still not a cell, all mechanical and all measured rather
  // than assumed. Without the second and third, the counter reported cells for 11 of the catalog's
  // 29 models that those models do not have — `Gemini 3.1 Pro` picked up five that way, every one
  // of them either a row a scripted batch had already replaced or a row whose benchmark publishes
  // no version. `ingest.mjs` refuses both, so counting them is counting cells that never appear.
  //   dropped      the catalog deliberately does not carry that benchmark
  //   superseded   a scripted read of the same page replaced it
  //   no version   no published version and no fallback declared
  const columnFor = (file, raw) => {
    if (!raw.benchmark || isDropped(raw.benchmark)) return null;
    if (supersededBy(file, raw.benchmark, raw.benchmark_version, null, raw.model_raw)) return null;
    const canonical = aliases.get(raw.benchmark) ?? raw.benchmark;
    if (!raw.benchmark_version && !fallbacks.get(canonical)) return null;
    const id = splits.get(`${canonical}|${raw.benchmark_version}`) ?? canonical;
    return columns.has(id) ? id : null;
  };

  const { batches, parameterBatches } = readArchiveFiles();

  // A fourth reason, and the only one that is a judgement rather than a mechanism — which is why
  // it is inherited rather than invented. `scripts/propose-attribution.mjs` refuses any string
  // published ONLY inside a maker's release capture, on the grounds that a maker printing a
  // rival's score states no harness, no effort and no date. The same rows must not count toward a
  // floor that decides whether a model earns a catalog record: measured here, Qwen's release post
  // alone would have credited Qwen3.7 Max with seven cells the catalog deliberately does not take.
  // Identified by HOW the batch was collected, never by `meta.release` — LiveBench carries a
  // `release` too and it means something else entirely.
  const releaseCapture = new Set(
    batches.filter(({ meta }) => String(meta.collectedWith ?? "").includes("capture-release-tables")).map((b) => b.file),
  );

  const observations = new Map();   // norm(model_raw) -> [column id]
  const parameters = new Set();     // norm(model_raw) that has an operating-parameter row
  for (const { file, rows } of batches) {
    if (releaseCapture.has(file)) continue;
    for (const { raw } of rows) {
      const column = columnFor(file, raw);
      if (!column) continue;
      const key = norm(raw.model_raw);
      if (!observations.has(key)) observations.set(key, []);
      observations.get(key).push(column);
    }
  }
  for (const { rows } of parameterBatches) for (const { raw } of rows) parameters.add(norm(raw.model_raw));

  /**
   * `needles` are the published spellings to look for — a provider slug's tail, a display name, a
   * catalog id. A normalised PREFIX match is used, not equality, because the archive carries the
   * operating point on the string (`muse-spark-1.1-xhigh`, `Muse Spark 1.2 (xhigh)`) where the
   * provider feed does not. Prefix is why a needle shorter than four characters is refused: `gpt`
   * would match every OpenAI model ever published.
   */
  return (needles) => {
    const wanted = [...new Set(needles.map(norm).filter((needle) => needle.length > 3))];
    const cells = [];
    let rows = 0;
    let hasParameters = false;
    for (const needle of wanted) {
      for (const [key, hits] of observations) {
        if (key === needle || key.startsWith(needle)) { rows += hits.length; cells.push(...hits); }
      }
      for (const key of parameters) if (key === needle || key.startsWith(needle)) hasParameters = true;
    }
    return { rows, cells: [...new Set(cells)], parameters: hasParameters };
  };
};

/**
 * The number of filled cells a new model must bring to avoid lowering cell coverage. Adding a
 * model widens the grid by one full column-count, so (filled + k) / ((models + 1) * benchmarks)
 * beats filled / (models * benchmarks) exactly when k > filled / models. That is arithmetic, not
 * an editorial threshold, and it is recomputed rather than stored because it moves as the board
 * fills.
 */
export const dilutionFloor = (filledCells, modelCount) => Math.ceil(filledCells / modelCount);

// ---------------------------------------------------------------- self-test
//
// The counter is only trustworthy to the extent it finds evidence that demonstrably exists, so the
// catalog's own models are the test set: each one's true cell count is known, and replaying the
// counter against its published spellings says how much of it a name-only match recovers. This is
// the number that decides whether the floor is reachable at all — a counter that recovers a tenth
// of the truth would refuse every model forever and look like a policy rather than a bug.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[/\\]/, ""))) {
  if (process.argv.includes("--self-test")) {
    const { MODELS, BENCHMARKS, OBSERVATIONS_BY_CELL } = await import("../../app/model-data.ts");
    const lookup = buildEvidenceIndex(BENCHMARKS.map((b) => b.id));
    const filled = MODELS.reduce((total, m) => total + Object.keys(OBSERVATIONS_BY_CELL[m.id] ?? {}).length, 0);
    const floor = dilutionFloor(filled, MODELS.length);
    console.log(`Dilution floor right now: ${floor} cells (${filled} filled / ${MODELS.length} models).\n`);
    console.log("model                 true  found  recovered   over-count?");
    let over = 0;
    const ratios = [];
    for (const model of MODELS) {
      const truth = new Set(Object.keys(OBSERVATIONS_BY_CELL[model.id] ?? {}));
      const found = lookup([model.id, model.name]);
      const hit = found.cells.filter((cell) => truth.has(cell)).length;
      const spurious = found.cells.filter((cell) => !truth.has(cell));
      if (spurious.length) over++;
      const pct = truth.size ? (100 * hit) / truth.size : 0;
      ratios.push(pct);
      console.log(
        `${model.id.padEnd(20)} ${String(truth.size).padStart(4)}  ${String(found.cells.length).padStart(5)}  ` +
        `${pct.toFixed(0).padStart(8)}%   ${spurious.length ? spurious.join(",") : "-"}`,
      );
    }
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    console.log(`\nmean recovery ${mean.toFixed(0)}% | models where the counter found a cell they do not have: ${over}`);
    process.exit(0);
  }
}
