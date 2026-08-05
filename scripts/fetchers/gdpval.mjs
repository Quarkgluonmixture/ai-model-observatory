// GDPval-AA, read by rendering the leaderboard Artificial Analysis publishes for free.
//
// AA's REST API carries this evaluation behind the Pro tier — `/api/v2` answers 403 for GDPval-AA
// and AA-LCR, which is why batch 14 could not reach it and why §9 listed GDPval as having no
// scripted path. The *page* is public and needs no key. It renders client-side, so this is the
// first fetcher that drives a browser rather than fetching a file.
//
// That makes it the most fragile source in the set: a layout change breaks it in a way a JSON
// endpoint would not. It is worth it because GDPval-AA is a core cell for the professional-work
// axis and the alternative is transcribing 186 rows by eye every few weeks — which is how the
// archive ended up with 14 rows and no way to tell when they went stale.
//
// The evaluation settings are read off the page, not carried over from the transcription: it
// states that models get shell access and web browsing in an agentic loop via Stirrup, and that
// Elo comes from blind pairwise comparisons. If that sentence changes, the note changes with it.
//
// LIVE: AA adds models and re-runs comparisons, so movement is new data.

import { openBrowser, TABLES_EXPRESSION } from "../lib/render.mjs";

const PAGE = "https://artificialanalysis.ai/evaluations/gdpval-aa";
const VERSION = "GDPval-AA v2";

// The operating point is inside the published name, in two spellings: "(Adaptive Reasoning, Max
// Effort)" for Anthropic and "(max)" for everyone else. Only a token that is actually printed
// becomes an effort.
const EFFORT = /\b(max|xhigh|high|medium|low)\s+effort\b|\((max|xhigh|high|medium|low)\)/i;
const effortOf = (name) => {
  const match = name.match(EFFORT);
  return match ? (match[1] ?? match[2]).toLowerCase() : null;
};

export const gdpval = {
  id: "gdpval",
  label: "Artificial Analysis GDPval-AA v2 leaderboard",
  batch: "batch-19-gdpval",
  versioning: "live",

  async fetch() {
    const browser = await openBrowser();
    let tables;
    let method;
    try {
      tables = await browser.evaluate(PAGE, TABLES_EXPRESSION, 12000);
      // The one sentence that states the harness and the tool setting. Read every run so the
      // rows never claim a setting the page has stopped describing.
      method = await browser.evaluate(PAGE, `document.body.innerText.slice(0, 1200)`, 500);
    } finally {
      browser.close();
    }

    const table = (tables ?? []).find((rows) => rows.length > 5);
    if (!table) throw new Error(`no leaderboard table rendered at ${PAGE} — the page changed`);

    const header = table[0].map((cell) => cell.toLowerCase());
    const col = (name) => {
      const index = header.findIndex((cell) => cell === name);
      if (index === -1) throw new Error(`no "${name}" column at ${PAGE} — columns are ${header.join(", ")}`);
      return index;
    };
    const [nameAt, eloAt, ciAt, dateAt] = [col("name"), col("elo"), col("ci"), col("release date")];
    const creatorAt = col("creator");

    const harness = /via (\w+)/.exec(method)?.[1] ?? null;
    if (!harness) throw new Error("the page no longer names the agentic harness; refusing to assume Stirrup");
    const tools = /shell access and web browsing/i.test(method);

    const rows = table.slice(1)
      .map((cells) => ({ name: cells[nameAt], elo: Number(cells[eloAt]), ci: cells[ciAt], date: cells[dateAt], creator: cells[creatorAt] }))
      .filter((row) => row.name && Number.isFinite(row.elo))
      .map((row) => ({
        model_raw: row.name,
        benchmark: "gdpval",
        benchmark_version: VERSION,
        // Elo, not a percentage. It is a preference rating between models on the same task set,
        // which is why the catalog keeps it on the professional axis and never mixes it with an
        // accuracy column.
        score: row.elo,
        unit: "Elo",
        harness,
        reasoning_effort: effortOf(row.name),
        tools_enabled: tools,
        context_length: null,
        // The board publishes a release month, not an evaluation date. Recording "Jul 2026" as an
        // evaluation date would assert something the page does not say, so it stays in the note.
        evaluation_date: null,
        source_label: `Artificial Analysis ${VERSION} leaderboard`,
        source_url: PAGE,
        source_kind: "independent",
        note:
          `对象：GDPval-AA v2，OpenAI GDPval 数据集的 AA 评测框架，44 个职业 9 大行业；` +
          `打分：盲对比 Elo，${row.ci ? `95% CI ${row.ci}` : "未标注置信区间"}；` +
          `脚手架 ${harness}${tools ? "（有 shell 与网页浏览）" : ""}；` +
          `发布方 ${row.creator ?? "未标注"}${row.date ? `；模型发布 ${row.date}` : ""}`,
      }));

    const makers = new Set(table.slice(1).map((cells) => cells[creatorAt]).filter(Boolean));
    if (rows.length < 20) throw new Error(`only ${rows.length} rows rendered at ${PAGE}; refusing to write a partial batch`);

    return {
      rows,
      version: VERSION,
      summary: `${rows.length} configurations from ${makers.size} makers, harness ${harness}`,
      meta: {
        batch: "19 · GDPval-AA v2",
        collectedWith: "scripts/fetchers/gdpval.mjs",
        filtered: false,
        release: VERSION,
        sources: [PAGE],
        note:
          `AA 的 REST API 把 GDPval-AA 放在 Pro 档后面（/api/v2 返回 403），所以 batch 14 拿不到它，` +
          `§9 一度记为「无脚本路径」。但公开页面不需要 key，只是客户端渲染，因此这是第一个用浏览器` +
          `而不是取文件的 fetcher —— 也因此是这批源里最脆的一个：改版会让它坏，而 JSON 端点不会。` +
          `harness 与工具设置每次都从页面正文重新读取（"in an agentic loop via Stirrup"、` +
          `"shell access and web browsing"），页面不再这么写时 fetcher 会拒绝写入而不是沿用旧假设。` +
          `板子只给「发布月份」不给评测日期，所以 evaluation_date 为 null，月份留在 note 里。` +
          `取代 batch 04 眼抄的 14 行 —— 见 model-aliases.json 的 supersededRows。`,
      },
    };
  },
};
