// Agents' Last Exam, read from the endpoint its leaderboard calls.
//
// Batch 03 recorded ALE as hand-read because "ALE publishes nothing machine-readable", and batch
// 16 hand-read three more rows to patch the gaps that left. It publishes plenty: the leaderboard
// is a Next.js page whose client chunk calls `/api/demo/leaderboard`, and that endpoint returns
// every run — 689 rows across 25 models, 15 harnesses and 12 splits, with pass rate, partial
// credit, task counts and cost. The path is not guessable, which is why two passes missed it:
// `/api/leaderboard` and `/data/leaderboard.json` are both 404, and the working one only appears
// inside `_next/static/chunks/app/leaderboard/page-*.js`.
//
// The mapping is checkable rather than assumed. The archive already held GPT-5.6 Sol under Codex
// at 30.6 with "partial-credit score 53.6%" in its note, hand-read from the page; this endpoint
// gives that configuration passRate 0.30592 and avgScore 0.53616. Same measurement, more digits.
// The 19 hand-read rows are superseded — see `supersededRows` in data/model-aliases.json.
//
// LIVE: the board gains models and re-runs configurations, so movement is new data.

const SITE = "https://agents-last-exam.org";
const ENDPOINT = `${SITE}/api/demo/leaderboard`;
const VERSION = "ALE-V1";

// The board publishes twelve splits. `full` is the headline the page ranks on and the one the
// transcribed rows recorded; the rest are subsets (last-exam, near-term, full-spectrum) and
// licence variants. Carrying them all would put four numbers in one cell that differ because
// they answer different questions, which is what rule 4 forbids. Their existence is in the meta.
const HEADLINE_SPLIT = "full";

// The harness variant carries the operating point: `reasoning-xhigh`, `thinking-max`, `max`.
// Only a token that is actually printed becomes an effort — a null variant stays null rather
// than being guessed into "default".
const effortOf = (variant) => {
  if (!variant) return null;
  const token = String(variant).split("-").at(-1);
  return ["low", "medium", "high", "xhigh", "max"].includes(token) ? token : null;
};

export const ale = {
  id: "ale",
  label: "Agents' Last Exam official leaderboard",
  batch: "batch-18-ale",
  versioning: "live",

  async fetch() {
    const response = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${ENDPOINT}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
      throw new Error(`no rows in ${ENDPOINT} — the endpoint shape changed`);
    }

    const splits = [...new Set(payload.rows.map((row) => row.split))];
    const headline = payload.rows.filter((row) => row.split === HEADLINE_SPLIT);
    if (headline.length === 0) {
      throw new Error(`no "${HEADLINE_SPLIT}" split in ${ENDPOINT} — it publishes ${splits.join(", ")}`);
    }

    const rows = headline
      .filter((row) => row.model && Number.isFinite(row.passRate))
      .map((row) => ({
        model_raw: row.model,
        benchmark: "ale",
        benchmark_version: VERSION,
        // Pass rate is the board's headline metric and what the archived rows already hold.
        // The partial-credit score answers a different question and rides in the note, the same
        // way Epoch's OSWorld partial score does.
        score: Number((row.passRate * 100).toFixed(2)),
        unit: "%",
        // The published harness slug, not a prettified version of it: a cell legitimately holds
        // one row per scaffold, and inventing display names would make two readings of the same
        // harness look like two harnesses the day somebody spells one differently.
        harness: row.harness ?? null,
        reasoning_effort: effortOf(row.harnessVariant),
        tools_enabled: true,
        context_length: null,
        // The endpoint dates nothing. An evaluation date invented from the fetch time would be
        // wrong on every row that has not been re-run since, so it stays null and the batch's
        // retrievedDate is the only time this archive claims to know.
        evaluation_date: null,
        source_label: "Agents' Last Exam official leaderboard",
        source_url: `${SITE}/leaderboard`,
        source_kind: "benchmark",
        note:
          `对象：ALE ${VERSION} ${HEADLINE_SPLIT} 划分 ${row.splitTasks ?? row.tasks ?? "?"} 题；` +
          `打分：pass rate = 拿满分的运行占比（${row.passes ?? "?"}/${row.runs ?? "?"} 次运行）；` +
          `部分分平均 ${Number.isFinite(row.avgScore) ? (row.avgScore * 100).toFixed(2) : "?"}%；` +
          `脚手架 ${row.harness}${row.harnessVariant ? `（${row.harnessVariant}）` : ""}` +
          `${Number.isFinite(row.totalCostUsd) ? `；总成本 $${row.totalCostUsd.toFixed(2)}（${row.costSource ?? "未标注"}价）` : ""}`,
      }));

    const models = new Set(rows.map((row) => row.model_raw));
    const harnesses = new Set(rows.map((row) => row.harness));

    return {
      rows,
      version: VERSION,
      summary: `${rows.length} configurations across ${models.size} models and ${harnesses.size} harnesses ` +
        `(${HEADLINE_SPLIT} split of ${payload.rows.length} published rows)`,
      meta: {
        batch: "18 · Agents' Last Exam",
        collectedWith: "scripts/fetchers/ale.mjs",
        filtered: true,
        filterRule:
          "The endpoint returns 689 rows across 12 splits. This batch takes the split the catalog's `ale` column means and leaves the other eleven, which answer different questions and would compete in one cell. They are named in the note rather than dropped silently.",
        release: VERSION,
        sources: [ENDPOINT, `${SITE}/leaderboard`],
        note:
          `从 leaderboard 页面自己调用的 ${ENDPOINT} 读取，该路径只出现在客户端 chunk 里，` +
          `猜不出来（/api/leaderboard 与 /data/leaderboard.json 都是 404）。` +
          `端点共 ${payload.rows.length} 行、${splits.length} 个划分：${splits.join("、")}；` +
          `本批只取 ${HEADLINE_SPLIT}（页面据以排名、也是转录行记录的那个），其余是子集或授权变体，` +
          `合进同一格会让四个回答不同问题的数字互相竞争。部分分、运行次数与成本留在每行 note 里。` +
          `端点不给评测日期，因此 evaluation_date 为 null，retrievedDate 是本档唯一敢声称的时间。`,
      },
    };
  },
};
