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
// One overstatement is inherent and stays: this matches by published STRING, and a string can mean
// two models. `deepseek-v4-flash` is the one case. In `batch-26-aa-evaluations` that bare slug
// carries two complete score sets, and they are told apart by `reasoning_effort` and nothing else:
//
//   reasoning max    AA "DeepSeek V4 Flash 0731 (Reasoning, Max Effort)", released 2026-07-31
//                    → this catalog record. Aliased, effort-pinned, and its six cells are ingested.
//   non-reasoning    AA "DeepSeek V4 Flash (Non-reasoning)", released 2026-04-24 → the preview.
//                    Deliberately unmapped, IFBench 47.21 among its seven rows.
//
// `ingest` gets this right because `resolveModelId` is given the effort. This counter cannot: it
// matches on the string with effort tokens stripped, which is the whole reason it works for a model
// that has no alias yet. So it credits the release with the preview's IFBench row — one cell, on one
// model, in the safe direction (the other one admits a model on another model's evidence).
//
// It is pinned in the self-test below as a named exemption rather than smoothed away, and there is
// nothing here to repair: the archive records the distinction and the alias file already uses it.
// ⚠ A previous pass through this comment (2026-08-10) claimed the batch recorded no field separating
// the two and that it needed re-capturing. That was a measurement error — the field is
// `reasoning_effort`, and it was read under the wrong name. Do not re-derive that conclusion.
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
  // What may follow the family name is an OPERATING POINT and nothing else. This is not a nicety;
  // it is the difference between this counter working and being actively dangerous, and it took
  // two goes to get right:
  //
  //   no guard at all      `GPT-5` normalises to `gpt5` and prefix-matches `gpt55`, `gpt56sol` and
  //                        every other GPT-5.x string. It was credited with 55 cells. `Claude Opus
  //                        4` got 51 the same way, `kimi-k2` got 46.
  //   digits only          fixed those and still let `gpt-5.2` collect `gpt-5.2-codex`,
  //                        `GPT-5.2 Pro (High)` and `gpt-5.2-chat-latest-20260210`. Caught by
  //                        `scripts/propose-model.mjs` proposing to map all three to GPT-5.2 —
  //                        every one of them is in the alias file's deliberately-unmapped list and
  //                        `gpt-5.2-codex` is in the attribution gate's trap set.
  //
  // So the rule is the project's own, borrowed rather than invented: after the family name,
  // nothing may be left over except an effort token. `propose-attribution.mjs` states it as
  // "nothing may be left over after stripping the effort", and a size, tier or variant word is not
  // an effort — Pro is a different model, Codex is a different model, Flash-Lite is not Flash.
  //
  // The cost is real and is the right cost: a string carrying a thinking budget (`-thinking-16k`)
  // or a serving route (`-bedrock`) no longer counts, so the number is a lower bound by more than
  // it was. A floor that undercounts leaves a model in the queue for a person. A floor that
  // overcounts admits a model on another model's evidence.
  const EFFORT_TOKENS = [
    "maxeffort", "xhigheffort", "higheffort", "mediumeffort", "loweffort", "minimaleffort",
    "nonreasoning", "adaptivereasoning", "reasoning", "nonthinking", "thinking",
    "max", "xhigh", "high", "medium", "low", "minimal", "none", "effort", "auto",
  ];
  const matches = (key, needle) => {
    if (key === needle) return true;
    if (!key.startsWith(needle)) return false;
    let rest = key.slice(needle.length);
    // A remainder may be several stacked tokens: "reasoningmaxeffort", "nonreasoninghigh".
    for (let changed = true; rest.length && changed;) {
      changed = false;
      for (const token of EFFORT_TOKENS) {
        if (rest.startsWith(token)) { rest = rest.slice(token.length); changed = true; break; }
      }
    }
    return rest.length === 0;
  };

  return (needles) => {
    const wanted = [...new Set(needles.map(norm).filter((needle) => needle.length > 3))];
    const cells = [];
    let rows = 0;
    let hasParameters = false;
    for (const needle of wanted) {
      for (const [key, hits] of observations) {
        if (matches(key, needle)) { rows += hits.length; cells.push(...hits); }
      }
      for (const key of parameters) if (matches(key, needle)) hasParameters = true;
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
//
// It used to print and always exit 0, which made it a command somebody had to remember to run —
// the same shape as `check:mobile` before 2026-08-07, and it rotted the same way: a comment in
// `report-gaps.mjs` quoted "89% recovery, 0 over-counts" while the real numbers had moved to 70%
// and 1. So it is now a gate, and it runs in CI. Two assertions, and neither is a target to
// optimise:
//
//   an over-count that is not pinned below   FAILS — the counter started crediting a model with
//                                            evidence that belongs to something else, which is how
//                                            a model gets admitted over the dilution floor on
//                                            another model's rows.
//   mean recovery under RECOVERY_FLOOR       FAILS — the matching rules broke badly enough that
//                                            the floor stops being reachable, which looks like a
//                                            policy ("nothing ever qualifies") rather than a bug.
//
// A pinned exemption that stops occurring is reported, not failed: the archive moves daily and a
// green run turning red because a known problem went away is the wrong incentive. Delete the pin
// when its report says nobody needs it.
const KNOWN_OVERCOUNTS = [
  {
    model: "deepseek-v4-flash",
    cells: ["ifbench"],
    // The long version is at the top of this file. Short: one AA slug carries the 0731 release and
    // the April preview, separated by `reasoning_effort`. `ingest` uses that field and attributes
    // both correctly; this counter strips effort by design, so it picks up the preview's IFBench row.
    // Nothing to repair — do not "fix" it by teaching the matcher about effort, which is what makes
    // it work for models that have no alias yet.
    reason: "one AA slug = 0731 release + April preview, separated only by effort, which this counter strips by design",
  },
];

// Not a target, a regression guard. Measured 2026-08-10: 70%. It was 89% when this was written and
// fell as the archive grew and the effort-token guard tightened, both expected — a lower bound is
// allowed to loosen. 60 is below today's value by enough that ordinary archive growth will not trip
// it, and far enough above zero that a broken matcher will.
const RECOVERY_FLOOR = 60;

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[/\\]/, ""))) {
  if (process.argv.includes("--self-test")) {
    const { MODELS, BENCHMARKS, OBSERVATIONS_BY_CELL } = await import("../../app/model-data.ts");
    const lookup = buildEvidenceIndex(BENCHMARKS.map((b) => b.id));
    const filled = MODELS.reduce((total, m) => total + Object.keys(OBSERVATIONS_BY_CELL[m.id] ?? {}).length, 0);
    const floor = dilutionFloor(filled, MODELS.length);
    console.log(`Dilution floor right now: ${floor} cells (${filled} filled / ${MODELS.length} models).\n`);
    console.log("model                 true  found  recovered   over-count?");
    const pinnedFor = (modelId) => KNOWN_OVERCOUNTS.find((entry) => entry.model === modelId);
    const unexpected = [];
    const unusedPins = new Set(KNOWN_OVERCOUNTS.map((entry) => entry.model));
    let over = 0;
    const ratios = [];
    for (const model of MODELS) {
      const truth = new Set(Object.keys(OBSERVATIONS_BY_CELL[model.id] ?? {}));
      const found = lookup([model.id, model.name]);
      const hit = found.cells.filter((cell) => truth.has(cell)).length;
      const spurious = found.cells.filter((cell) => !truth.has(cell));
      if (spurious.length) over++;
      const pin = pinnedFor(model.id);
      // Pinned per CELL, not per model: a pinned model growing a second spurious cell is a new
      // finding and must not ride in on the old exemption.
      const newCells = spurious.filter((cell) => !(pin?.cells ?? []).includes(cell));
      if (spurious.length && pin) unusedPins.delete(model.id);
      if (newCells.length) unexpected.push({ model: model.id, cells: newCells });
      const pct = truth.size ? (100 * hit) / truth.size : 0;
      ratios.push(pct);
      const mark = spurious.length
        ? spurious.map((cell) => ((pin?.cells ?? []).includes(cell) ? `${cell} (pinned)` : `${cell} ⚠ NEW`)).join(",")
        : "-";
      console.log(
        `${model.id.padEnd(20)} ${String(truth.size).padStart(4)}  ${String(found.cells.length).padStart(5)}  ` +
        `${pct.toFixed(0).padStart(8)}%   ${mark}`,
      );
    }
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    console.log(`\nmean recovery ${mean.toFixed(0)}% | models where the counter found a cell they do not have: ${over}`);
    console.log(`${KNOWN_OVERCOUNTS.length} pinned exemption(s): ` +
      KNOWN_OVERCOUNTS.map((entry) => `${entry.model}/${entry.cells.join("+")} — ${entry.reason}`).join("; "));

    let failed = false;
    for (const { model, cells } of unexpected) {
      console.log(`FAIL  ${model} is credited with ${cells.join(", ")}, which it does not have and which is not pinned.`);
      failed = true;
    }
    if (mean < RECOVERY_FLOOR) {
      console.log(`FAIL  mean recovery ${mean.toFixed(0)}% is under the ${RECOVERY_FLOOR}% floor.`);
      failed = true;
    }
    for (const model of unusedPins) {
      console.log(`note  the pinned exemption for ${model} no longer occurs — delete it (this is not a failure).`);
    }
    console.log(failed ? "self-test FAILED" : "self-test passed");
    process.exit(failed ? 1 : 0);
  }
}
