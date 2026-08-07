// Artificial Analysis' per-benchmark scores — the half of AA this project was throwing away.
//
// `scripts/fetchers/artificial-analysis.mjs` reads `/api/v2/language/models/free` and takes one
// field out of the `evaluations` object: the intelligence index. That endpoint publishes three
// keys. **A different path on the same key publishes seventeen**, and this reads that one:
//
//   /api/v2/language/models/free   150KB   3 evaluation keys   (the parameters fetcher)
//   /api/v2/data/llms/models       514KB   17 evaluation keys  (this one)
//
// Measured 2026-08-07, both 200 on the same key. `/api/v2/language/models` (no `/free`) is the
// Pro tier and 403s; `/api/v2/data/llms/models` does not. That also retires a claim in the other
// fetcher's header: it says AA-LCR "lives behind the Pro tier and returns 403, so it has no
// scripted path". `lcr` is on this path for 488 models.
//
// This is a SEPARATE batch from 14 on purpose. Batch 14 declares `meta.schema` as model operating
// parameters, which is exactly what keeps its rows out of the observation store and inside
// `check:models`. Benchmark scores are observations. Same source, same key, different kind of row.
//
// ## Every mapping below was checked against AA's own methodology table
//
// https://artificialanalysis.ai/methodology/intelligence-benchmarking publishes questions,
// repeats, scoring and — the column that decides one of these mappings — Tool Usage.
//
//   GPQA Diamond          198 q,   5 repeats, regex pass@1,          tools ✗
//   HLE                 2,158 q,   1 repeat,  equality-checker LLM,  tools ✗   <- answers "which HLE"
//   SciCode               288 sub, 3 repeats, code execution,        tools ✗
//   AA-LCR                100 q,   3 repeats, equality-checker LLM,  tools ✗
//   Terminal-Bench v2.1    89 q,   3 repeats, test suite pass@1,     tools ✗
//   𝜏³-Banking             97 q,   5 repeats, DB state pass@1,       tools ✓
//   IFBench               294 q,   5 repeats, rule-driven pass@1,    tools ✗
//
// `hle` mapping to `hle-no-tools` rather than `hle-tools` is that table's Tool Usage column and
// nothing else. Guessing it would have put a no-tools score in a with-tools column, which is the
// shape of every wrong number this project has published.
//
// ## Ten fields collected but NOT mapped, each with the reason
//
// Changed 2026-08-07: these used to be refused at the fetch layer, so they were never written down
// at all. That makes a refusal invisible — nobody can audit a number that does not exist in the
// archive, and the day a judgement changes the data has to be re-collected. They are now archived
// under AA's own field names and blocked at ingest by `droppedBenchmarks`, which is the mechanism
// this project already uses for 814 other rows and the same principle the ARC fetcher applies to
// entries that are not models. +2,225 archived rows, zero change to the board.
//
// **`terminalbench_hard`** — AA's own methodology says it is "Superseded by Terminal-Bench v2.1,
// which we use going forward" and "no longer part of the Artificial Analysis Intelligence Index or
// our active reporting". Collecting a retired evaluation would publish a number its own publisher
// has withdrawn. 432 models carry it; none of them are collected here.
//
// **`tau2`** — 440 models carry it and it appears in NEITHER the methodology table NOR the
// leaderboard. What it measures is therefore a guess, and `AGENTS.md` rule 7 is that a source you
// have not opened yourself does not get added. Note it is not the same thing as `tau_banking`,
// which the methodology does document as 𝜏³-Banking.
//
// **`mmlu_pro`** — exactly one catalog model carries it, the catalog's `mmlu-pro` column declares
// version "2025", and AA publishes no version label. Asserting that AA ran that version, for one
// cell, is a version claim bought too cheaply.
//
// **`livecodebench`** — the catalog's column is `vals-livecodebench`, which is Vals' run of it.
// AA runs its own (315 q, 3 repeats). Two harnesses in one column is rule 4. One catalog model
// carries AA's, which is not enough to justify a second column.
//
// **`artificial_analysis_{coding,math,agentic}_index`** — composites. The mission statement is
// that the dashboard separates capability rather than hiding it inside one universal score, and
// the one composite this project does carry (`intelligence`) is a model *parameter* in batch 14,
// not an observation. These belong there if anywhere.
//
// ## Why `manual`, like the parameters fetcher
//
// AA re-measures continuously. The other fetcher's header explains what that does to a daily job,
// and the reasoning carries: a scheduled re-read would rewrite this batch whenever AA re-ran an
// evaluation, and every such rewrite would move a published number. Run it on demand —
// `AA_API_KEY=… node scripts/fetch-source.mjs aa-evals` — and read `describe-change` afterwards.

const API = "https://artificialanalysis.ai/api/v2/data/llms/models";

// AA suffixes the operating point onto the slug, the same convention batch 14 already relies on.
// Kept identical to that fetcher rather than shared, because the day they diverge is the day one
// of them is wrong and a shared helper would hide which.
const EFFORTS = ["non-reasoning", "reasoning", "minimal", "medium", "xhigh", "high", "low", "max"];
const splitEffort = (slug) => {
  for (const effort of EFFORTS) {
    if (slug.endsWith(`-${effort}`)) return { modelRaw: slug.slice(0, -(effort.length + 1)), effort };
  }
  return { modelRaw: slug, effort: null };
};

// The slug is not the whole story, and measuring that was the difference between these rows being
// comparable and being invisible. **134 of AA's models put the operating point ONLY in the display
// name**: the slug is `gpt-5-6-sol` and the name is "GPT-5.6 Sol (max)". Reading the slug alone
// files that as effort-null, and effort is the key both the disagreement gate and the
// one-source-one-cell gate group on — so a max-effort score would sit in its own bucket forever,
// never compared against anybody else's max-effort score, which is the whole point of collecting
// a second reading. `scripts/fetchers/epoch.mjs` hit this first and calls its version
// `effortFromName`.
//
// Only consulted when the slug says nothing. AA publishes `gpt-5-6-sol` (name: max) alongside
// `gpt-5-6-sol-high` and never alongside a `-max` sibling, so the two paths do not collide — and
// if that ever changes, two strings resolving to one cell in one batch is exactly what the
// one-source-one-cell gate fails on rather than silently merging.
// Two dimensions, and taking either one alone is a documented way to publish a wrong number.
// AA writes "(Reasoning, Max Effort)" and "(Non-reasoning, High Effort)" — a MODE and a LEVEL. The
// first draft of this returned whichever came first in the comma list, which made
// `deepseek-v4-flash` "reasoning" when it is max, and `claude-sonnet-5-non-reasoning` "non-reasoning"
// when it is also high. Ten records were affected.
//
// Neither token alone is the configuration. `data/model-aliases.json`'s `_doc` records what
// happens when you pick one: "Claude Sonnet 5 (Non-reasoning, High Effort) — reasoning and
// non-reasoning are different modes, but both parse to effort 'high', so mapping both put two
// operating modes in one cell", caught by the one-source-one-cell gate the day it was written.
//
// So when both are present both are kept, as `"<mode> <level>"`. It cannot collide with a plain
// `high` from the reasoning sibling, it loses nothing, and the archive already carries compound
// efforts of this shape — batch 01 has "thinking 16K" and "thinking none". A parenthetical naming
// only one of the two yields that one; naming neither yields null rather than a guess.
const LEVELS = ["minimal", "medium", "xhigh", "high", "low", "max"];
const MODES = ["non-reasoning", "reasoning"];
const effortFromName = (name) => {
  const match = /\(([^)]+)\)\s*$/.exec(name ?? "");
  if (!match) return null;
  // "Adaptive Reasoning" is neither: it is Anthropic's product name for the mode selector, not an
  // operating point, so it falls through and the level beside it is what gets recorded.
  const parts = match[1].split(",").map((part) => part.trim().toLowerCase().replace(/\s*effort\s*$/, ""));
  const level = parts.find((part) => LEVELS.includes(part)) ?? null;
  const mode = parts.find((part) => MODES.includes(part)) ?? null;
  if (level && mode) return `${mode} ${level}`;
  return level ?? mode;
};

// AA publishes proportions for the pass@1 evaluations and points for the indices. Every field
// below is a proportion, and the catalog stores percentages.
const pct = (value) => (typeof value === "number" && Number.isFinite(value) ? Number((value * 100).toFixed(2)) : null);

// One entry per collected field. `version` matches what the archive already uses for that column,
// so an AA row lands beside the existing rows rather than opening a second version of the column —
// `Diamond`, `Full` and `2.1` are split names the source itself states, and `2026` is the label
// this project already uses for the two AA-originated columns it carries.
// Collected into the archive but NOT into the observation store. `AGENTS.md` calls the archive
// evidence and append-only, and the ARC fetcher already archives entries that are not models at all
// on the same principle — rule 8's "the intended outcome, not a gap". Refusing at the fetch layer
// instead makes a refusal invisible: nobody can audit a number that was never written down, and
// the day the judgement changes the data has to be re-collected.
//
// So these are archived under AA's own field name — none of which collides with a catalog column —
// and each has a `droppedBenchmarks` entry in `data/model-aliases.json` carrying the reason it does
// not reach the board. `check:data` fails on an unknown benchmark id, so that entry is not optional
// paperwork; it is what keeps the archive honest and the store clean at the same time.
const ARCHIVE_ONLY = [
  { key: "terminalbench_hard", note: "Terminal-Bench Hard；⚠ AA 自己的方法论页写着它已被 v2.1 取代、不再属于 Intelligence Index 也不在 active reporting —— 归档是「AA 曾发布过什么」的证据，不进看板" },
  { key: "tau2", note: "AA 的 tau2 字段；⚠ 方法论页和排行榜页都查不到它 —— 测什么不清楚，所以归档但不进看板" },
  { key: "mmlu_pro", note: "MMLU-Pro 12,032 题 ×1 轮，10 选 1，正则抽取 pass@1；⚠ AA 不公布版本，而目录的 mmlu-pro 列声明版本 2025，对不上 —— 归档等版本问题解决" },
  { key: "livecodebench", note: "LiveCodeBench 315 题 ×3 轮，代码执行 pass@1；⚠ 目录那列是 Vals 跑的（vals-livecodebench），AA 跑的是自己那套，两个 harness 不能进同一列（铁律 4）" },
  { key: "aime", note: "AIME；目录没有这一列 —— 归档备用" },
  { key: "aime_25", note: "AIME 2025；目录没有这一列 —— 归档备用" },
  { key: "math_500", note: "MATH-500；目录没有这一列 —— 归档备用" },
];

const FIELDS = [
  { key: "gpqa", benchmark: "gpqa", version: "Diamond", tools: false, note: "198 题 ×5 轮，正则抽取 pass@1" },
  { key: "hle", benchmark: "hle-no-tools", version: "Full", tools: false, note: "2,158 题 ×1 轮，equality-checker LLM 判分；AA 方法论表 Tool Usage 列为 ✗，所以是 no-tools 那一列" },
  { key: "scicode", benchmark: "scicode", version: "2026", tools: false, note: "288 个子问题（测试集）×3 轮，代码执行 pass@1，带科学家标注的背景提示" },
  { key: "lcr", benchmark: "aa-lcr", version: "2026", tools: false, note: "AA-LCR 100 题 ×3 轮，equality-checker LLM pass@1" },
  {
    key: "terminalbench_v2_1", benchmark: "terminal", version: "2.1", tools: false, system: true,
    note: "Terminal-Bench v2.1，89 题 ×3 轮，测试套件 pass@1；⚠ AA 不公布它用的 scaffold，harness 留空",
  },
  { key: "tau_banking", benchmark: "tau3-banking", version: "2026", tools: true, system: true, note: "𝜏³-Banking 97 题 ×5 轮，双向控制的 agent-用户模拟，按后端数据库状态判 pass@1" },
  { key: "ifbench", benchmark: "ifbench", version: "2026", tools: false, note: "IFBench 294 题 ×5 轮，抽取 + 规则判定 pass@1" },
];

export const aaEvaluations = {
  id: "aa-evals",
  label: "Artificial Analysis benchmark evaluations",
  batch: "batch-26-aa-evaluations",
  // Never selected by `--live`; see the header.
  versioning: "manual",

  available: () => Boolean(process.env.AA_API_KEY),
  unavailableReason: "AA_API_KEY is not set; skipping Artificial Analysis evaluations (on-demand source).",

  async fetch() {
    const key = process.env.AA_API_KEY;
    if (!key) throw new Error("AA_API_KEY is not set");

    const response = await fetch(API, { headers: { "x-api-key": key } });
    if (response.status === 403) throw new Error(`403 from ${API} — the key lacks access to this endpoint`);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${API}`);
    const payload = await response.json();
    const models = payload.data ?? [];
    if (models.length === 0) throw new Error("the API returned no models");

    // A field vanishing upstream must not read as "every model lost that score". The archive is
    // rewritten wholesale on each run, so a silently dropped key would delete a column's worth of
    // rows and the diff would call it drift.
    const present = new Set(models.flatMap((model) => Object.keys(model.evaluations ?? {})));
    const missing = FIELDS.filter((field) => !present.has(field.key)).map((field) => field.key);
    if (missing.length) {
      throw new Error(
        `${missing.join(", ")} no longer appear in any model's evaluations — the API changed shape. ` +
        `Keys it does publish: ${[...present].sort().join(", ")}`,
      );
    }

    const rows = [];
    for (const model of models) {
      const slug = model.slug;
      if (!slug) continue;
      const split = splitEffort(slug);
      const modelRaw = split.modelRaw;
      const effort = split.effort ?? effortFromName(model.name);
      const evaluations = model.evaluations ?? {};

      for (const field of [...FIELDS, ...ARCHIVE_ONLY.map((f) => ({ ...f, benchmark: f.key, version: null, tools: null }))]) {
        const score = pct(evaluations[field.key]);
        if (score === null) continue;
        rows.push({
          model_raw: modelRaw,
          benchmark: field.benchmark,
          benchmark_version: field.version,   // null on the archive-only fields: AA states no version

          score,
          unit: "%",
          // AA states no scaffold for either of the two system-mode evaluations. Null rather than
          // an invented label: rule 6 says a system benchmark is model + scaffold, and a made-up
          // scaffold name is worse than an absent one.
          harness: null,
          reasoning_effort: effort,
          tools_enabled: field.tools,
          context_length: null,
          // Null on purpose. AA publishes `release_date`, which is when the MODEL shipped, not
          // when AA ran the evaluation, and `byPrimaryPreference` sorts on this field — the exact
          // mistake batch 01's ARC rows made with ARC's `modelReleaseDate`.
          evaluation_date: null,
          source_label: "Artificial Analysis evaluations",
          source_url: `https://artificialanalysis.ai/models/${slug}`,
          source_kind: "independent",
          note:
            `AA 名称 ${model.name}` +
            (model.release_date ? `；模型发布 ${model.release_date}（非评测日）` : "") +
            `；${field.note}` +
            `；来自 ${API}，AA 自己跑的评测，非厂商自报`,
        });
      }
    }

    const byBenchmark = rows.reduce((counts, row) => ({ ...counts, [row.benchmark]: (counts[row.benchmark] ?? 0) + 1 }), {});
    return {
      rows,
      version: "v2",
      summary:
        `${rows.length} evaluation rows across ${models.length} published models — ` +
        Object.entries(byBenchmark).map(([id, n]) => `${id} ${n}`).join(", "),
      meta: {
        batch: "26 · Artificial Analysis benchmark evaluations",
        collectedWith: "scripts/fetchers/aa-evaluations.mjs",
        filtered: true,
        release: "v2",
        sources: [API, "https://artificialanalysis.ai/methodology/intelligence-benchmarking"],
        note:
          "AA's per-benchmark scores, from /api/v2/data/llms/models — a DIFFERENT path from batch 14's " +
          "/api/v2/language/models/free, on the same key. Measured 2026-08-07: the free path publishes 3 " +
          "evaluation keys and this one publishes 17. Kept separate from batch 14 because that batch " +
          "declares model operating parameters, which is what keeps its rows out of the observation store. " +
          "FILTERED: 7 of the 17 keys are collected. Every mapping was checked against AA's own " +
          "methodology table, which is also what decides that `hle` is the no-tools column — its Tool " +
          "Usage entry is ✗. NOT collected, each for a stated reason: terminalbench_hard (AA says it is " +
          "superseded by v2.1 and out of active reporting), tau2 (440 models carry it and it appears in " +
          "neither the methodology nor the leaderboard, so what it measures is a guess), mmlu_pro and " +
          "livecodebench (one catalog model each, and both would need a version or a harness claim the " +
          "source does not state), and the three composite indices (the catalog carries composites as " +
          "model parameters, not observations). " +
          "harness is NULL on the two system-mode rows because AA publishes no scaffold; " +
          "evaluation_date is NULL because AA publishes only the MODEL's release date. " +
          "manual: AA re-measures continuously, so this is on demand and never in the daily refresh — " +
          "a scheduled re-read would move published numbers every time AA re-ran an evaluation.",
      },
    };
  },
};
