// Epoch AI's FrontierMath boards, read from the file the leaderboard itself fetches.
//
// This source exists because the ZIP that `epoch.mjs` reads does NOT publish these numbers, and
// the reason took a while to find, so it is written down here rather than rediscovered:
//
//   benchmark_data.zip holds `frontiermath.csv` (101 rows, top score 52.40) and
//   `frontiermath_tier_4.csv` (72 rows). Those are the **2025-02-28 / 2025-07-01 question sets**.
//   The boards the site renders are `FrontierMath-Tiers-1-3-v2-Private` (42 rows, top 89.12) and
//   `FrontierMath-Tier-4-v2-Private` (44 rows) — a later, different question set. Comparing the two
//   produced the "the export runs about 1.7x below the page" note that used to sit in epoch.mjs
//   and read as an unexplained divergence. It is not a divergence: it is two benchmark versions.
//
// Where the v2 rows live: `/models/…/BenchmarkBody.*.js` imports `benchmarks.*.js`, which calls
// `fetch('/data/benchmarks.csv')`. That CSV keys every run by `task`, and the board page's own
// island props name the board `FrontierMath-Tiers-1-3-v2-Private` — the same string. So the CSV is
// the board's data file, not a second export of it.
//
// Cross-checked against the transcription before replacing it: every one of batch 01's hand-read
// rows that this file also carries agrees to the decimal place it was rounded to, 15 of 15, both
// tiers. Batch 01 is superseded for `frontiermath` — see `supersededRows` in model-aliases.json.

import { parseCsv } from "../lib/unzip.mjs";
import { splitEffort, pct } from "./epoch.mjs";

const CSV = "https://epoch.ai/data/benchmarks.csv";
const HUB = "https://epoch.ai/benchmarks";

// One version covers both tiers: Epoch ships them as a pair and names them the same way. The
// catalog splits Tier 4 into its own benchmark id downstream (`benchmarkSplits`), because a Tier 4
// score read against another model's Tiers 1-3 score is a wrong comparison, not a harder one.
const boards = (version) => [
  {
    task: `FrontierMath-Tiers-1-3-${version}-Private`,
    benchmarkVersion: `Tiers 1-3 (${version})`,
    slug: `frontiermath-tiers-1-3-${version}`,
    label: `Epoch AI FrontierMath Tiers 1-3 (${version}) leaderboard`,
    tier: "Tiers 1-3",
  },
  {
    task: `FrontierMath-Tier-4-${version}-Private`,
    benchmarkVersion: `Tier 4 (${version})`,
    slug: `frontiermath-tier-4-${version}`,
    label: `Epoch AI FrontierMath Tier 4 (${version}) leaderboard`,
    tier: "Tier 4",
  },
];

// Stated on both board pages, identically, as the model's affordances rather than per row: the
// model may "use the python tool to execute arbitrary Python code" and submits through
// `submit_answer`, under "a hard limit of 1,000,000 tokens". The CSV carries neither, so they are
// read off the page the CSV belongs to — the same call livebench.mjs makes for its scaffold. If
// the page ever stops saying it, these two fields are the ones to re-check.
const TOOLS_ENABLED = true;
const CONTEXT_LENGTH = "1M";

const fetchCsv = async () => {
  const response = await fetch(CSV);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${CSV}`);
  return parseCsv(await response.text());
};

// Only the `Tiers-1-3-<version>` family names a version this way; the retired sets are called
// `FrontierMath-2025-02-28-Private` and are deliberately not matched, so a v-series release is what
// `latestVersion` can report and an old set can never be mistaken for a new one.
const VERSION_PATTERN = /^FrontierMath-Tiers-1-3-(v\d+)-Private$/;

export const epochFrontierMath = {
  id: "epoch-frontiermath",
  label: "Epoch AI FrontierMath",
  batch: "batch-28-frontiermath",

  // The question set is frozen — `task version` is 2.0.0 on every v2 row and the problems are
  // private — but the guest list is not: Epoch keeps running newly released models against v2
  // (Qwen3.8 Max was added on 2026-08-04, six weeks after GPT-5.6). So a row that appears is new
  // data and a row that moved is Epoch having rescored something under a frozen version, which is
  // a human's call. That is `append-only`, for the same reason LiveBench is.
  versioning: "append-only",
  archiveVersion: (rows) => {
    const match = /\((v\d+)\)$/.exec(rows[0].benchmark_version ?? "");
    if (!match) throw new Error(`cannot read a version out of "${rows[0].benchmark_version}"`);
    return match[1];
  },

  latestVersion: async () => {
    const versions = new Set();
    for (const record of await fetchCsv()) {
      const match = VERSION_PATTERN.exec(record.task ?? "");
      if (match) versions.add(match[1]);
    }
    if (versions.size === 0) throw new Error(`no FrontierMath-Tiers-1-3-v*-Private task in ${CSV}`);
    return [...versions].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).at(-1);
  },

  async fetch(version) {
    const target = version ?? (await epochFrontierMath.latestVersion());
    const records = await fetchCsv();

    const rows = [];
    const counts = [];
    let skippedStatus = 0;

    for (const board of boards(target)) {
      const mine = records.filter((record) => record.task === board.task);
      if (mine.length === 0) {
        // Not "no results yet": these boards are published with rows or not at all, so an empty
        // filter means the task was renamed, and writing an empty batch would delete the archive.
        throw new Error(`no rows for task "${board.task}" in ${CSV} — the export changed shape`);
      }

      const seen = new Set();
      for (const record of mine) {
        // The site's own loader drops anything that is not a completed run; a failed run has no
        // published score to carry.
        if (record.Status && record.Status !== "Success") { skippedStatus += 1; continue; }

        // Two rows for one configuration means Epoch ran it twice and somebody has to say which
        // one the board publishes. Guessing would put a number on the dashboard that no page shows.
        if (seen.has(record.model)) {
          throw new Error(`${board.task}: "${record.model}" appears twice — a re-run needs a human`);
        }
        seen.add(record.model);

        // `mean_score` is the column the leaderboard's own chunk reads. `best_score` and
        // `Best score (across scorers)` are identical to it on every v2 row today because there is
        // exactly one scorer (`verification_code`); if a second scorer ever appears they diverge,
        // and which one the board publishes is a question for a reader, not a default.
        const alternatives = [record.best_score, record["Best score (across scorers)"]];
        for (const alternative of alternatives) {
          if (alternative !== record.mean_score) {
            throw new Error(
              `${board.task}: "${record.model}" has mean_score ${record.mean_score} but ` +
              `${alternative} in another score column — a second scorer needs a human`,
            );
          }
        }

        const score = pct(record.mean_score);
        if (score === null || !record.model) continue;
        const { modelRaw, effort } = splitEffort(record.model);
        const stderr = pct(record.stderr);

        rows.push({
          model_raw: modelRaw,
          benchmark: "frontiermath",
          benchmark_version: board.benchmarkVersion,
          score,
          unit: "%",
          harness: null,
          reasoning_effort: effort,
          tools_enabled: TOOLS_ENABLED,
          context_length: CONTEXT_LENGTH,
          // Epoch's run timestamp. The row's "Version release date" in the same record is the
          // model's release date and must never be used here.
          evaluation_date: (record.started_at || "").slice(0, 10) || null,
          source_label: board.label,
          source_url: `${HUB}/${board.slug}`,
          // FrontierMath is Epoch's own benchmark, so this is a benchmark-native board rather than
          // a third party re-running someone else's evaluation — the distinction
          // `sourceKindOverrides` already records for Epoch's GPQA page.
          source_kind: "benchmark",
          note:
            `对象：Epoch AI 自行运行的 FrontierMath ${board.tier} 私有题集评测；` +
            `打分：模型提交 answer() 函数，由 verification_code 判分，按正确率计` +
            (stderr === null ? "" : `；标准误 ±${stderr}`) +
            `；可用 python 与 submit_answer 工具，token 硬上限 1,000,000`,
        });
      }
      // Rows actually written, not rows seen: an unsuccessful run that got skipped must not be
      // counted as collected in the summary the pull request quotes.
      counts.push(`${board.tier} ${rows.filter((row) => row.benchmark_version === board.benchmarkVersion).length}`);
    }

    // A stable order, so a refresh that adds one model produces a one-line diff rather than a
    // reshuffled file: tiers first, then the board's own ranking, then the string as a tiebreak.
    const order = boards(target).map((board) => board.benchmarkVersion);
    rows.sort((a, b) =>
      order.indexOf(a.benchmark_version) - order.indexOf(b.benchmark_version) ||
      b.score - a.score ||
      a.model_raw.localeCompare(b.model_raw));

    return {
      rows,
      version: target,
      summary:
        `${rows.length} rows — ${counts.join(", ")}` +
        (skippedStatus ? ` (${skippedStatus} unsuccessful run(s) skipped)` : ""),
      meta: {
        batch: "28 · Epoch AI FrontierMath",
        collectedWith: "scripts/fetchers/epoch-frontiermath.mjs",
        filtered: true,
        filterRule:
          `Of the 1,300-odd runs in benchmarks.csv this batch takes the two FrontierMath ${target} ` +
          "private boards and nothing else. The retired 2025-02-28 and 2025-07-01 sets are in the " +
          "same file and are a different question set, not older readings of this one; the public " +
          "sets are twelve released problems, not a leaderboard.",
        release: target,
        sources: [CSV, ...boards(target).map((board) => `${HUB}/${board.slug}`)],
        licence: "CC BY 4.0 — Epoch AI, 'AI Benchmarking Hub', https://epoch.ai/benchmarks",
        note:
          "Read from /data/benchmarks.csv, which is the file the board page's own client chunk " +
          "fetches — not a transcription of the rendered table and not the benchmark_data.zip " +
          "export, whose frontiermath.csv holds the retired 2025-02-28 question set and therefore " +
          "scores about 1.7x lower for the same model. score is mean_score, the column the page " +
          "reads, verified equal to best_score on every row. Reasoning effort is split off the " +
          "model string (claude-opus-5_max) onto the row. evaluation_date is Epoch's run " +
          "timestamp, never the model's release date. tools_enabled and context_length come from " +
          "the board page's stated affordances (python + submit_answer, 1,000,000-token hard " +
          "limit), which the CSV does not carry. This batch supersedes batch 01's transcription " +
          "of the same two boards — see supersededRows in data/model-aliases.json.",
      },
    };
  },
};
