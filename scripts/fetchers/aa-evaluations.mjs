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
// ## Five fields deliberately NOT mapped, each with the reason
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
const NAMED = ["non-reasoning", "reasoning", "minimal", "medium", "xhigh", "high", "low", "max"];
const effortFromName = (name) => {
  const match = /\(([^)]+)\)\s*$/.exec(name ?? "");
  if (!match) return null;
  // "(Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)" — a comma list, and only the level is
  // wanted. A parenthetical that names no level at all yields null rather than a guess.
  for (const part of match[1].split(",").map((p) => p.trim().toLowerCase().replace(/\s*effort\s*$/, ""))) {
    if (NAMED.includes(part)) return part;
  }
  return null;
};

// AA publishes proportions for the pass@1 evaluations and points for the indices. Every field
// below is a proportion, and the catalog stores percentages.
const pct = (value) => (typeof value === "number" && Number.isFinite(value) ? Number((value * 100).toFixed(2)) : null);

// One entry per collected field. `version` matches what the archive already uses for that column,
// so an AA row lands beside the existing rows rather than opening a second version of the column —
// `Diamond`, `Full` and `2.1` are split names the source itself states, and `2026` is the label
// this project already uses for the two AA-originated columns it carries.
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

      for (const field of FIELDS) {
        const score = pct(evaluations[field.key]);
        if (score === null) continue;
        rows.push({
          model_raw: modelRaw,
          benchmark: field.benchmark,
          benchmark_version: field.version,
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
