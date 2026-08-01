// LiveBench, read from the files the site itself loads.
//
// LiveBench renders client-side, so the leaderboard has no table text to transcribe — batch 05
// recorded it as UNAVAILABLE for exactly that reason. The page fetches `./table_<release>.csv`,
// `./categories_<release>.json` and `./cost_<release>.csv`, so those files are the published
// numbers, not a rendering of them.
//
// This is a transcription, mechanised. It copies cells and never computes one: LiveBench's
// category and global averages are derived client-side from these task columns, so they are
// deliberately not written here.

const SITE = "https://livebench.ai";
// The site's own asset directory, which is the authoritative list of published releases.
const RELEASE_INDEX = "https://api.github.com/repos/LiveBench/livebench.github.io/contents/public";

// Effort tokens LiveBench prints inside the model string. Only a token that literally
// appears is recorded; anything else stays null so nobody has to guess what "auto" meant.
const EFFORT_TOKENS = [
  ["-max-effort", "max"],
  ["-max", "max"],
  ["-xhigh-effort", "xhigh"],
  ["-xhigh", "xhigh"],
  ["-high-effort", "high"],
  ["-high", "high"],
  ["-medium-effort", "medium"],
  ["-medium", "medium"],
  ["-low-effort", "low"],
  ["-low", "low"],
];

const readEffort = (modelRaw) => {
  for (const [token, effort] of EFFORT_TOKENS) {
    if (modelRaw.endsWith(token)) return effort;
  }
  return null;
};

const benchmarkId = (task) => `livebench-${task.toLowerCase().replaceAll("_", "-")}`;

// LiveBench's agentic coding tasks run an agent loop in a per-task Docker image, so they are
// system results and the contract wants their scaffold named. The leaderboard does not print
// one, but the runner is not a guess: LiveBench vendors mini-SWE-agent at
// livebench/agentic_code_runner/minisweagent and drives those tasks through it.
const AGENTIC_HARNESS = "mini-SWE-agent";
const AGENTIC_CATEGORY = "Agentic Coding";

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  const body = await response.text();
  // A missing asset on GitHub Pages answers with the SPA shell or a 404 page, not an error.
  if (body.trimStart().startsWith("<")) throw new Error(`not a data file (got HTML) — ${url}`);
  return body;
};

const parseCsv = (text) => {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const headers = head.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
  });
};

export const livebench = {
  id: "livebench",
  label: "LiveBench",
  batch: "batch-09-livebench",

  // LiveBench replaces the question set between releases, so a release is a version and the
  // archive is pinned to one. A number that moves *under* a pinned version is drift, and drift
  // is an integrity failure — see scripts/fetch-source.mjs.
  versioning: "pinned",
  archiveVersion: (rows) => rows[0].benchmark_version,

  latestVersion: async () => {
    const listing = await (await fetch(RELEASE_INDEX)).json();
    const releases = listing
      .map((entry) => entry.name)
      .filter((name) => /^table_\d{4}_\d{2}_\d{2}\.csv$/.test(name))
      .map((name) => name.slice("table_".length, -".csv".length).replaceAll("_", "-"))
      .sort();
    if (releases.length === 0) throw new Error("no table_*.csv in the LiveBench asset directory");
    return releases.at(-1);
  },

  async fetch(version) {
    const release = version ?? (await livebench.latestVersion());
    const slug = release.replaceAll("-", "_");

    const [tableCsv, categoriesJson, costCsv] = await Promise.all([
      fetchText(`${SITE}/table_${slug}.csv`),
      fetchText(`${SITE}/categories_${slug}.json`),
      fetchText(`${SITE}/cost_${slug}.csv`).catch(() => null),
    ]);

    const table = parseCsv(tableCsv);
    const categories = JSON.parse(categoriesJson);
    const costs = costCsv ? parseCsv(costCsv) : [];

    // task -> the category LiveBench files it under, so the note can say what was measured.
    const categoryOf = new Map();
    for (const [category, tasks] of Object.entries(categories)) {
      for (const task of tasks) categoryOf.set(task, category);
    }

    const questionCount = new Map();
    for (const row of costs) {
      for (const [column, value] of Object.entries(row)) {
        if (!column.startsWith("nq_")) continue;
        const count = Number(value);
        if (Number.isFinite(count)) questionCount.set(`${row.model}|${column.slice(3)}`, count);
      }
    }

    const tasks = Object.keys(table[0]).filter((column) => column !== "model");
    const unfiled = tasks.filter((task) => !categoryOf.has(task));
    if (unfiled.length > 0) {
      // A task with no category is a shape change upstream; stop rather than file it blindly.
      throw new Error(`tasks missing from categories_${slug}.json: ${unfiled.join(", ")}`);
    }

    const rows = [];
    let blank = 0;
    for (const entry of table) {
      const modelRaw = entry.model;
      const effort = readEffort(modelRaw);
      for (const task of tasks) {
        const raw = entry[task];
        if (raw === undefined || raw === "" || raw === "N/A") {
          blank += 1;
          continue;
        }
        const score = Number(raw);
        if (!Number.isFinite(score)) {
          blank += 1;
          continue;
        }
        const category = categoryOf.get(task);
        const n = questionCount.get(`${modelRaw}|${task}`);
        rows.push({
          model_raw: modelRaw,
          benchmark: benchmarkId(task),
          benchmark_version: release,
          score,
          unit: "%",
          harness: category === AGENTIC_CATEGORY ? AGENTIC_HARNESS : null,
          reasoning_effort: effort,
          tools_enabled: category === AGENTIC_CATEGORY ? true : null,
          context_length: null,
          evaluation_date: release,
          source_label: `LiveBench ${release} · ${category} · ${task}`,
          source_url: `${SITE}/#/?release=${release}`,
          // LiveBench publishes its own tasks, so this is a benchmark-native leaderboard rather
          // than a third party re-running someone else's evaluation.
          source_kind: "benchmark",
          note:
            `对象：LiveBench ${category} 类任务 ${task}；` +
            `打分：题目自带客观答案，按正确率计 0-100，无人工与模型评委` +
            (n === undefined ? "" : `；本次发布该任务 ${n} 题`) +
            (category === AGENTIC_CATEGORY
              ? `；在按任务构建的 Docker 镜像内经 ${AGENTIC_HARNESS} 代理循环执行，榜单页面未标注该脚手架，依据为仓库 livebench/agentic_code_runner/minisweagent`
              : ""),
        });
      }
    }

    const efforts = rows.filter((row) => row.reasoning_effort !== null).length;
    return {
      rows,
      version: release,
      summary:
        `${table.length} models × ${tasks.length} tasks -> ${rows.length} rows ` +
        `(${blank} blank cells skipped, ${efforts} rows carry a published effort)`,
      meta: {
        batch: "09 · LiveBench",
        collectedWith: "scripts/fetchers/livebench.mjs",
        filtered: false,
        release,
        sources: [
          `${SITE}/table_${slug}.csv`,
          `${SITE}/categories_${slug}.json`,
          `${SITE}/cost_${slug}.csv`,
        ],
        note:
          "LiveBench renders client-side and publishes no transcribable table, so this batch is " +
          "fetched from the data files the page itself loads rather than read off the screen. " +
          "Every row is one published task cell. LiveBench's category averages and Global Average " +
          "are computed in the browser from these same columns and are deliberately NOT archived: " +
          "they are derived, not published. reasoning_effort holds only an effort token that " +
          "literally appears in the model string (…-max-effort, …-xhigh); everything else is null. " +
          "source_kind is benchmark, not independent: LiveBench publishes its own tasks. The " +
          "Agentic Coding tasks are system results run through mini-SWE-agent, which the " +
          "leaderboard does not print — the scaffold is taken from the runner LiveBench vendors " +
          "at livebench/agentic_code_runner/minisweagent, and is recorded on each such row. " +
          "benchmark_version is the release date because that is how LiveBench versions the " +
          "question set — releases must never be merged, the questions change between them.",
      },
    };
  },
};
