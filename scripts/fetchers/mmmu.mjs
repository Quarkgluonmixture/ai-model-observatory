// MMMU-Pro, read from the leaderboard the benchmark's own team publishes.
//
// Batch 04 hand-read two rows off this page. The page carries 213, and — the reason this fetcher
// is worth more than the row count suggests — it distinguishes results it verified from results a
// model's own authors sent in. Its legend says so in one line under the table:
//
//     *: results provided by the authors.
//
// The two transcribed rows recorded "Author-reported result" in their note and were filed as
// `source_kind: "benchmark"` anyway. That is the highest precedence this project has, so a vendor
// self-report was outranking every verified reading in its cell. Here the asterisk decides the
// source kind, which is what it means.
//
// LIVE: the board gains models continuously.

import { openBrowser, TABLES_EXPRESSION } from "../lib/render.mjs";

const PAGE = "https://mmmu-benchmark.github.io/";
const VERSION = "Pro";

// The board's first header row spans the three benchmarks (MMMU-Pro, MMMU(Val), MMMU(Test)) and
// the second names the columns under them. The catalog's `mmmu` column is MMMU-Pro Overall, which
// is the first scored column; Vision and Standard are its two splits and ride in the note.
const NAME_AT = 0;
const SIZE_AT = 1;
const DATE_AT = 2;
const OVERALL_AT = 3;
const VISION_AT = 4;
const STANDARD_AT = 5;

// "86.9*" -> { value: 86.9, authorReported: true }. A dash is not a zero and not a row.
const readScore = (cell) => {
  const text = (cell ?? "").trim();
  if (!text || text === "-") return null;
  const authorReported = text.includes("*");
  const value = Number(text.replace(/[*†\s]/g, ""));
  return Number.isFinite(value) ? { value, authorReported } : null;
};

export const mmmu = {
  id: "mmmu",
  label: "MMMU official leaderboard",
  batch: "batch-20-mmmu",
  versioning: "live",

  async fetch() {
    const browser = await openBrowser();
    let tables;
    let legend;
    try {
      tables = await browser.evaluate(PAGE, TABLES_EXPRESSION, 12000);
      // Re-read the legend every run rather than trusting a comment. If the page stops saying what
      // the asterisk means, this fetcher must not keep asserting a source kind on its authority.
      // The whole body, not its tail: the legend sits inside the table's own container, so a
      // slice from the end of the document missed it and this fetcher refused to write — which
      // was the right failure, and the wrong place to look.
      legend = await browser.evaluate(PAGE, `document.body.innerText`, 500);
    } finally {
      browser.close();
    }

    const table = (tables ?? []).find((rows) => rows.length > 20);
    if (!table) throw new Error(`no leaderboard table rendered at ${PAGE} — the page changed`);
    if (!/results provided by the authors/i.test(legend ?? "")) {
      throw new Error("the MMMU legend no longer explains its asterisk; refusing to assume it still marks author-reported results");
    }

    const rows = table
      .filter((cells) => cells.length > OVERALL_AT)
      .map((cells) => ({ cells, name: (cells[NAME_AT] ?? "").trim(), score: readScore(cells[OVERALL_AT]) }))
      // Header rows, the "Reset" control, and the human baselines the board prints alongside the
      // models. A human expert is not a model and must never become a catalog row.
      .filter((row) => row.name && row.score && !/^(name|reset)$/i.test(row.name) && !/^human expert/i.test(row.name))
      .map(({ cells, name, score }) => {
        const vision = readScore(cells[VISION_AT]);
        const standard = readScore(cells[STANDARD_AT]);
        const size = (cells[SIZE_AT] ?? "").trim();
        const date = /^\d{4}-\d{2}-\d{2}$/.test((cells[DATE_AT] ?? "").trim()) ? cells[DATE_AT].trim() : null;
        return {
          model_raw: name,
          benchmark: "mmmu",
          benchmark_version: VERSION,
          score: score.value,
          unit: "%",
          harness: null,
          // The board prints the operating point inside the model name ("... Thinking (High)"),
          // and the alias table is where that is interpreted. Nothing is parsed out of it here.
          reasoning_effort: null,
          tools_enabled: null,
          context_length: null,
          evaluation_date: date,
          source_label: "MMMU official leaderboard",
          source_url: PAGE,
          // The asterisk, not a guess. An author-reported number is a vendor self-report however
          // it is displayed, and filing it as benchmark-native would let it outrank a verified run.
          source_kind: score.authorReported ? "vendor" : "benchmark",
          note:
            `对象：MMMU-Pro Overall；` +
            `${score.authorReported ? "作者自报（榜单以 * 标注，未经榜方验证）" : "榜方验证结果"}；` +
            `${vision ? `Vision ${vision.value}；` : ""}${standard ? `Standard ${standard.value}；` : ""}` +
            `${size && size !== "-" ? `参数量 ${size}；` : ""}` +
            `模型名内的运行设置由 alias 解释，本处不做拆分`,
        };
      });

    if (rows.length < 50) throw new Error(`only ${rows.length} rows parsed at ${PAGE}; refusing to write a partial batch`);

    const verified = rows.filter((row) => row.source_kind === "benchmark").length;
    return {
      rows,
      version: VERSION,
      summary: `${rows.length} models (${verified} verified by the board, ${rows.length - verified} author-reported)`,
      meta: {
        batch: "20 · MMMU-Pro leaderboard",
        collectedWith: "scripts/fetchers/mmmu.mjs",
        filtered: true,
        release: VERSION,
        sources: [PAGE],
        note:
          `MMMU 官方榜,渲染后读取(页面是客户端渲染的)。取 MMMU-Pro Overall 一列，` +
          `Vision 与 Standard 两个划分留在 note 里 —— 它们回答不同问题，合进一格会互相竞争。` +
          `⭐ 关键区别：榜单图例写明「*: results provided by the authors」，因此带星的行是厂商自报，` +
          `source_kind 记为 vendor；不带星的是榜方验证，记为 benchmark。批次 04 眼抄的两行 note 里` +
          `写了「Author-reported result」却填成 benchmark，等于让自报结果拿到最高源优先级、在格子里` +
          `压过验证过的读数 —— 那两行由本批取代，见 model-aliases.json 的 supersededRows。` +
          `每次运行都重新校验图例文案，页面不再这么写时 fetcher 拒绝写入而不是沿用旧假设。` +
          `Human Expert 基线行被过滤：人不是模型，不能进目录。`,
      },
    };
  },
};
