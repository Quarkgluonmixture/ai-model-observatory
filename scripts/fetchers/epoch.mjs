// Epoch AI's benchmark export — one CC BY ZIP holding 76 CSVs, at a fixed URL.
//
// Two kinds of file are in there and the difference decides how each row is classed:
//
//   Epoch's own evaluations — frontiermath, frontiermath_tier_4, gpqa_diamond. Epoch ran these.
//     The rows carry the reasoning effort inside the model string, a standard error, the run
//     timestamp, and a link to the raw inspect log. That is richer provenance than the catalog
//     previously held for these cells.
//
//   *_external.csv — Epoch transcribing somebody else's board, with a Source Link per row.
//     Second-hand by definition, so these are only carried where no first-hand path exists
//     (§4 source policy), and always as `independent` — never `benchmark`. Source precedence
//     then does the rest: if a native fetcher is ever written for one of these boards, its rows
//     outrank these automatically and these become listed variants.
//
// Four external files were examined and rejected, which is worth not rediscovering:
//   ale_bench_external.csv   ALE-Bench (AtCoder heuristic rating, ~2176) is a different
//                            benchmark from Agents' Last Exam. Same three letters, nothing else.
//   gdpval_external.csv      publishes a win rate; the catalog's `gdpval` is GDPval-AA, scored
//                            in Elo by Artificial Analysis. Different metric, different board.
//   hle_external.csv         states no tool setting anywhere, and HLE with and without tools are
//                            separate benchmarks here. Unusable without guessing.
//   terminalbench/deepswe    first-hand fetchers exist; see scripts/fetchers/.

import { parseCsv, readZip } from "../lib/unzip.mjs";

const ARCHIVE = "https://epoch.ai/data/benchmark_data.zip";
const HUB = "https://epoch.ai/benchmarks";

// Epoch writes the operating point onto the model string as `<slug>_<effort>`. Splitting it back
// out keeps effort on the observation row where this project puts it, and leaves one alias entry
// per model family rather than one per effort.
const UNKNOWN_EFFORTS = new Set(["unknown", "none", "default", ""]);
const splitEffort = (modelVersion) => {
  const cut = modelVersion.lastIndexOf("_");
  if (cut === -1) return { modelRaw: modelVersion, effort: null };
  const tail = modelVersion.slice(cut + 1).toLowerCase();
  // Only a token that reads as an operating point is treated as one; a slug that merely contains
  // an underscore keeps its name.
  const known = ["max", "xhigh", "high", "medium", "low", "minimal", "thinking", "non-reasoning"];
  if (known.includes(tail)) return { modelRaw: modelVersion.slice(0, cut), effort: tail };
  if (UNKNOWN_EFFORTS.has(tail)) return { modelRaw: modelVersion.slice(0, cut), effort: null };
  return { modelRaw: modelVersion, effort: null };
};

const pct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Epoch stores proportions; the catalog stores percentages.
  return Number((n * 100).toFixed(2));
};

const OWN = [
  {
    file: "frontiermath.csv", benchmark: "frontiermath", version: "Tiers 1-3 (v2)",
    // FrontierMath is Epoch's own benchmark, so its own numbers are benchmark-native.
    sourceKind: "benchmark", score: "mean_score", stderr: "stderr",
    url: `${HUB}/frontiermath-tiers-1-3-v2`, label: "Epoch AI FrontierMath Tiers 1-3",
  },
  {
    file: "frontiermath_tier_4.csv", benchmark: "frontiermath-t4", version: "Tier 4 (v2)",
    sourceKind: "benchmark", score: "mean_score", stderr: "stderr",
    url: `${HUB}/frontiermath-tier-4-v2`, label: "Epoch AI FrontierMath Tier 4",
  },
  {
    // GPQA belongs to someone else; Epoch running it is an independent evaluation. This is the
    // same call `sourceKindOverrides` already records for Epoch's GPQA page.
    file: "gpqa_diamond.csv", benchmark: "gpqa", version: "Diamond",
    sourceKind: "independent", score: "mean_score", stderr: "stderr",
    url: `${HUB}/gpqa`, label: "Epoch AI GPQA Diamond",
  },
];

const EXTERNAL = [
  {
    file: "arc_agi_2_external.csv", benchmark: "arc-agi-2", version: "v2", score: "Score",
    origin: "https://arcprize.org/leaderboard", originName: "ARC Prize verified leaderboard",
    // Confirmed to mirror the *verified* board, not the public-eval split: this file gives
    // gemini-3.1-pro-preview 0.771 and gemini-3.5-flash_high 0.7208, matching the catalog's
    // 77.1 and 72.1. ARC's own public-eval dataset on Hugging Face runs ~11 points higher and
    // is a different split — do not substitute it.
  },
  {
    file: "critpt_external.csv", benchmark: "critpt", version: "2026", score: "Accuracy",
    origin: "https://critpt.com/", originName: "CritPt leaderboard",
  },
  {
    file: "apex_agents_external.csv", benchmark: "apex", version: "2026", score: "Pass@1 score",
    origin: "https://www.mercor.com/apex/apex-agents-leaderboard/", originName: "Mercor APEX-Agents leaderboard",
  },
  {
    file: "osworld_2_external.csv", benchmark: "osworld2", version: "2.0", score: "Binary accuracy",
    origin: "https://osworld-v2.xlang.ai/", originName: "OSWorld 2.0 leaderboard",
    // The only external file that publishes the configuration alongside the score.
    effortColumn: "Reasoning", toolsColumn: "Tool setting",
  },
];

export const epoch = {
  id: "epoch",
  label: "Epoch AI benchmark export",
  batch: "batch-12-epoch",
  // The export is rebuilt in place at a fixed URL as Epoch evaluates more models. New rows are
  // new data, not a rewritten history.
  versioning: "live",

  async fetch() {
    const response = await fetch(ARCHIVE);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${ARCHIVE}`);
    const zip = readZip(Buffer.from(await response.arrayBuffer()));

    const rows = [];
    const counts = [];

    for (const spec of OWN) {
      const csv = zip.get(spec.file);
      if (!csv) throw new Error(`${spec.file} is missing from the export — it changed shape`);
      let kept = 0;
      for (const record of parseCsv(csv.toString("utf8"))) {
        const score = pct(record[spec.score]);
        if (score === null || !record["Model version"]) continue;
        const { modelRaw, effort } = splitEffort(record["Model version"]);
        const stderr = pct(record[spec.stderr]);
        rows.push({
          model_raw: modelRaw,
          benchmark: spec.benchmark,
          benchmark_version: spec.version,
          score,
          unit: "%",
          harness: null,
          reasoning_effort: effort,
          tools_enabled: null,
          context_length: null,
          // "Started at" is when Epoch ran the evaluation. "Release date" in the same row is the
          // model's release date and must never be used here.
          evaluation_date: (record["Started at"] || "").slice(0, 10) || null,
          source_label: spec.label,
          source_url: spec.url,
          source_kind: spec.sourceKind,
          note:
            `对象：Epoch AI 自行运行的评测；打分：${spec.benchmark === "gpqa" ? "标准答案正确率" : "题目自带答案，按正确率计"}` +
            (stderr === null ? "" : `；标准误 ±${stderr}`) +
            (record.Logs ? `；原始 inspect 日志 ${record.Logs}` : ""),
        });
        kept += 1;
      }
      counts.push(`${spec.benchmark} ${kept}`);
    }

    for (const spec of EXTERNAL) {
      const csv = zip.get(spec.file);
      if (!csv) throw new Error(`${spec.file} is missing from the export — it changed shape`);
      let kept = 0;
      for (const record of parseCsv(csv.toString("utf8"))) {
        const score = pct(record[spec.score]);
        if (score === null || !record["Model version"]) continue;
        const split = splitEffort(record["Model version"]);
        const effort = spec.effortColumn ? (record[spec.effortColumn] || null) : split.effort;
        const tools = spec.toolsColumn ? (record[spec.toolsColumn] || null) : null;
        rows.push({
          model_raw: split.modelRaw,
          benchmark: spec.benchmark,
          benchmark_version: spec.version,
          score,
          unit: "%",
          harness: null,
          reasoning_effort: effort,
          tools_enabled: tools,
          context_length: null,
          // These files carry the model's release date, not a run date. Dating a result with a
          // model release would be a fabrication, so the batch's retrievedDate carries it instead.
          evaluation_date: null,
          source_label: `Epoch AI benchmark hub · ${spec.originName}`,
          source_url: `${HUB}#${spec.benchmark}`,
          // Second-hand: Epoch transcribing another board. Never `benchmark`, whatever the
          // original board is, so a first-hand row always outranks this one.
          source_kind: "independent",
          note:
            `对象：Epoch AI 从${spec.originName}转录，原始来源 ${record.Source || spec.origin}` +
            (record["Partial score"] ? `；部分分 ${pct(record["Partial score"])}` : "") +
            (record["Step budget"] ? `；步数上限 ${record["Step budget"]}` : "") +
            (record["Pass@1 Standard Error"] ? `；Pass@1 标准误 ±${record["Pass@1 Standard Error"]}` : "") +
            "；二手转录，仅在无第一手来源时使用",
        });
        kept += 1;
      }
      counts.push(`${spec.benchmark} ${kept} (external)`);
    }

    return {
      rows,
      version: "benchmark_data.zip",
      summary: `${rows.length} rows — ${counts.join(", ")}`,
      meta: {
        batch: "12 · Epoch AI benchmark export",
        collectedWith: "scripts/fetchers/epoch.mjs",
        filtered: true,
        filterRule:
          "Of the export's 76 CSVs this batch takes Epoch's own three evaluations (FrontierMath " +
          "tiers 1-3, tier 4, GPQA Diamond) plus four *_external files for benchmarks the catalog " +
          "has no first-hand machine-readable path to (ARC-AGI-2, CritPt, APEX-Agents, OSWorld 2.0). " +
          "Everything else is either already fetched first-hand, or a different benchmark than its " +
          "filename suggests — see the header of scripts/fetchers/epoch.mjs.",
        release: "rolling",
        sources: [ARCHIVE, HUB],
        licence: "CC BY 4.0 — Epoch AI, 'AI Benchmarking Hub', https://epoch.ai/benchmarks",
        note:
          "Fetched from the ZIP Epoch publishes at a fixed URL, not read off a page. Epoch's own " +
          "evaluations are source_kind benchmark for FrontierMath (Epoch's own benchmark) and " +
          "independent for GPQA (Epoch running someone else's), which is the distinction already " +
          "recorded in sourceKindOverrides. The *_external rows are Epoch transcribing another " +
          "board and are always independent, so a first-hand row outranks them automatically. " +
          "Reasoning effort is split off the model string (claude-opus-5_max) onto the row. " +
          "evaluation_date is Epoch's run timestamp for its own evaluations and null for the " +
          "external files, which publish only the model's release date — dating a result with a " +
          "model release would be a fabrication.",
      },
    };
  },
};
