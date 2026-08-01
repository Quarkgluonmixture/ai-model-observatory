// DeepSWE, read from the artifact the leaderboard page loads.
//
// The page fetches `/artifacts/v1.1/leaderboard-live.json`, which carries every configuration
// DataCurve has run: model, harness, reasoning effort, pass@1, pass@4, confidence interval and
// cost. Batch 02 transcribed the same board by eye and got 18 rows of the "Best view" rounded to
// whole numbers (74 where the artifact says 73.6); this reads all 50, keeps one row per published
// operating point, and does not round. Those 18 transcribed rows are superseded — see
// `supersededRows` in data/model-aliases.json.
//
// The board is LIVE: DataCurve appends runs and the pass rates move. That is new data, not drift,
// so this fetcher is `versioning: "live"` and a change opens a pull request instead of failing a
// check. Only a pinned source rewriting history is an integrity failure.

const SITE = "https://deepswe.datacurve.ai";
const VERSION = "v1.1";
const ARTIFACT = `${SITE}/artifacts/${VERSION}/leaderboard-live.json`;

export const deepswe = {
  id: "deepswe",
  label: "DeepSWE official leaderboard",
  batch: "batch-11-deepswe",
  versioning: "live",

  async fetch() {
    const response = await fetch(ARTIFACT, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${ARTIFACT}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
      throw new Error(`no rows in ${ARTIFACT} — the artifact shape changed`);
    }

    // `generated_at` moves every time the artifact is rebuilt, whether or not a number changed,
    // so it must not reach a row: it would make every re-fetch look like new data. The
    // newest job's finish date only moves when results actually do.
    const finished = payload.latest_job?.finished_at;
    if (!finished) throw new Error("the artifact no longer names a latest job to date the rows");
    const evaluationDate = finished.slice(0, 10);

    const rows = payload.rows
      .filter((row) => row.model && Number.isFinite(row.pass_at_1))
      .map((row) => ({
        model_raw: row.model,
        benchmark: "deepswe",
        benchmark_version: VERSION,
        // pass@1 is the board's headline. Kept to one decimal, which is the precision the
        // artifact's own confidence interval justifies; never rounded to whole points.
        score: Number((row.pass_at_1 * 100).toFixed(1)),
        unit: "%",
        harness: row.harness ?? null,
        reasoning_effort: row.reasoning_effort ?? null,
        tools_enabled: null,
        context_length: null,
        evaluation_date: evaluationDate,
        source_label: `DeepSWE ${VERSION} official leaderboard`,
        // The page, not the artifact path: this is the same published source the transcribed
        // rows named, so both count against one source card rather than inventing a second.
        source_url: `${SITE}/`,
        source_kind: "benchmark",
        note:
          `对象：DeepSWE ${VERSION} 全量任务集 ${payload.n_tasks_in_set ?? "?"} 题；` +
          `打分：pass@1 = 已评分 rollout 的通过率（上下文超限与 agent 超时计失败，供应商/校验/网络错误剔除）` +
          (Number.isFinite(row.pass_at_4) ? `；pass@4 ${(row.pass_at_4 * 100).toFixed(1)}` : "") +
          (Number.isFinite(row.ci_half) ? `；95% 置信半宽 ±${(row.ci_half * 100).toFixed(1)}` : "") +
          (Number.isFinite(row.n_runs) ? `；${row.n_runs} 次完整重复` : "") +
          (Number.isFinite(row.n_attempted) ? `；${row.n_passed}/${row.n_attempted} 次尝试通过` : ""),
      }));

    const efforts = rows.filter((row) => row.reasoning_effort !== null).length;
    return {
      rows,
      version: VERSION,
      summary:
        `${rows.length} configurations (${efforts} carry a published effort), ` +
        `latest job ${payload.latest_job?.name ?? "?"} finished ${evaluationDate}`,
      meta: {
        batch: "11 · DeepSWE",
        collectedWith: "scripts/fetchers/deepswe.mjs",
        filtered: false,
        release: VERSION,
        sources: [ARTIFACT, `${SITE}/`],
        note:
          "Fetched from the artifact the DeepSWE leaderboard page itself loads, not read off the " +
          "screen. One row per published configuration — harness × model × reasoning effort — " +
          "because DataCurve publishes each separately and they must not be merged. score is " +
          "pass@1 at one decimal; pass@4, the 95% interval and the run count stay in the note " +
          "rather than becoming separate columns, since the catalog carries one metric for this " +
          "benchmark. evaluation_date is the finish date of the newest job included, NOT the " +
          "artifact's generated_at, which moves on every rebuild and would make each re-fetch " +
          "look like new data. This board is live: DataCurve appends runs and pass rates move, " +
          "so a difference here is new data and opens a pull request, never a drift failure. " +
          "Batch 02 transcribed 18 rows of the same board rounded to whole points; those are " +
          "superseded by this batch, recorded in data/model-aliases.json.",
      },
    };
  },
};
