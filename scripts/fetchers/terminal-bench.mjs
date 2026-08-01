// Terminal-Bench 2.1, read from the Supabase function the leaderboard page calls.
//
// The page renders client-side, so batch 02 transcribed it by eye. Harbor's own client posts a
// package/name selector to an Edge Function and gets the rows back; the call needs no key.
//
// The payload is the best-shaped source in the archive. One row carries the model, the agent that
// ran it, the reasoning effort, the run date, accuracy, trial count, pass@2..5 and a reward-hacking
// rate — every field the observation contract asks of a benchmark-native system result, including
// the harness that check:data requires and that a transcription of this board keeps losing.
//
// Standing risk: this is an undocumented endpoint discovered in client code, not a promised
// interface. It can move without notice. That is survivable here — the fetcher throws, the scheduled
// job reports it, and the archive is left exactly as it was.

const ENDPOINT = "https://ofhuhcpkvzjlejydnvyd.supabase.co/functions/v1/leaderboard-read";
const PACKAGE = "terminal-bench/terminal-bench-2-1";
const PAGE = "https://www.tbench.ai/leaderboard/terminal-bench/2.1";
const VERSION = "2.1";

const label = (value) => (value && typeof value === "object" ? value.label : value) ?? null;

export const terminalBench = {
  id: "terminal-bench",
  label: "Terminal-Bench",
  batch: "batch-13-terminal-bench",
  // The board accepts new submissions and re-ranks in place; new rows are new data.
  versioning: "live",

  async fetch() {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ package: PACKAGE, name: "main" }),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${ENDPOINT}`);
    const payload = await response.json();
    const entries = payload?.rows;
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("no rows in the Terminal-Bench response — the endpoint changed shape");
    }

    const rows = [];
    for (const entry of entries) {
      const meta = entry.metadata ?? {};
      const metrics = entry.metrics ?? {};
      const model = label(meta.model_display);
      const agent = label(meta.agent_display);
      const score = Number(metrics.accuracy);
      // A row missing its model or its scaffold cannot be filed: this benchmark measures the pair,
      // and a system result without a named harness fails the observation contract anyway.
      if (!model || !agent || !Number.isFinite(score)) continue;

      const passAt = [2, 3, 4, 5]
        .map((k) => [k, metrics[`pass_at_${k}`]])
        .filter(([, value]) => Number.isFinite(value))
        .map(([k, value]) => `pass@${k} ${(value * 100).toFixed(1)}`);

      rows.push({
        model_raw: model,
        benchmark: "terminal",
        benchmark_version: VERSION,
        score: Number(score.toFixed(2)),
        unit: "%",
        harness: agent,
        reasoning_effort: meta.reasoning_effort ?? null,
        tools_enabled: true,
        context_length: null,
        evaluation_date: meta.date ?? null,
        source_label: `Terminal-Bench ${VERSION} leaderboard`,
        source_url: PAGE,
        source_kind: "benchmark",
        note:
          `对象：Terminal-Bench ${VERSION} 任务集，经 ${agent} 脚手架在终端环境内执行；` +
          `打分：任务通过率` +
          (Number.isFinite(metrics.n_trials) ? `；${metrics.n_trials} 次试验` : "") +
          (passAt.length ? `；${passAt.join("、")}` : "") +
          (Number.isFinite(metrics.reward_hacks) ? `；奖励作弊率 ${metrics.reward_hacks}%` : "") +
          (label(meta.pr_url) ? `；提交 ${label(meta.pr_url)}` : ""),
      });
    }

    const efforts = rows.filter((row) => row.reasoning_effort !== null).length;
    return {
      rows,
      version: VERSION,
      summary: `${rows.length} submissions (${efforts} carry a published effort)`,
      meta: {
        batch: "13 · Terminal-Bench 2.1",
        collectedWith: "scripts/fetchers/terminal-bench.mjs",
        filtered: false,
        release: VERSION,
        sources: [ENDPOINT, PAGE],
        note:
          "Fetched from the Supabase Edge Function the leaderboard page itself calls, discovered " +
          "in Harbor's client code; it needs no key. One row per published submission — the board " +
          "measures a model/scaffold pair, so the agent is recorded as the harness and rows are " +
          "never merged across scaffolds. Reasoning effort and run date come from the row's own " +
          "metadata. pass@2..5, trial count and the reward-hacking rate stay in the note because " +
          "the catalog carries one metric per cell. This endpoint is undocumented and may move " +
          "without notice; the fetcher throws rather than writing a partial batch. Supersedes the " +
          "2.1 rows batch 02 transcribed from the same board — recorded in data/model-aliases.json. " +
          "The 2.0 rows in batch 02 are a different benchmark id and are untouched.",
      },
    };
  },
};
