// Captures a maker's release-post tables into a batch file.
//
//   node scripts/capture-release-tables.mjs qwen3.8            # writes data/sources/batch-NN-*.jsonl
//   node scripts/capture-release-tables.mjs qwen3.8 --stdout   # print, write nothing
//   node scripts/capture-release-tables.mjs --list
//
// Deliberately NOT a fetcher in scripts/fetchers/. A release post is published once and then
// frozen, so there is nothing for the daily job to re-read; the release *probe* watches for new
// posts, and this turns one into rows when somebody has decided how to read it.
//
// That decision is the whole reason this is not automatic. Which published label belongs in which
// catalog column is judgement — Qwen's post carries 86 benchmark labels and 12 of them map to a
// column this catalog holds. The other 74 are archived under their published names and carried by
// nothing, which is the correct outcome and not a gap to close.
//
// So adding a maker means adding an entry to RELEASES below, with its `carried` map written by
// someone who read the page. Everything else — rendering, parsing, dual numbers, the competitor
// columns, the batch meta — is shared.
//
// The pages render client-side; fetching Qwen's HTML returns the single word "Qwen".

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser } from "./lib/render.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

// One entry per captured release. `carried` maps a published label to the catalog column it
// belongs in, with the version that column already holds — never a new version invented here.
//
// `dual` names what a cell's second number means, where a page prints two. Qwen's are checkable
// rather than assumed: the page gives GPT-5.6 Sol's ALE as "30.6 / 53.6" and Opus 4.8's OSWorld
// 2.0 as "20.6 / 54.8", and both official boards are already archived with 30.6 and 20.6 as the
// score and the second figure as partial credit. Confirm the same way before adding a maker.
const RELEASES = {
  "qwen3.8": {
    label: "Qwen3.8 release",
    maker: "Alibaba",
    url: "https://qwen.ai/blog?id=qwen3.8",
    batch: "batch-17-qwen3.8-release",
    batchLabel: "17 · Qwen3.8 release tables",
    published: "2026-08-03",
    // The prefix each row's note carries. Kept separate from `label` because the archive is
    // evidence: changing this rewrites every row in the batch, and a refactor must not churn
    // 465 rows of transcription to say the same thing differently.
    noteName: "Qwen3.8",
    keep: "Qwen3.8-Max",
    // What was learned reading THIS page, appended to the generated meta. The template can only
    // say what is true of every release; a source's own traps have to be written by whoever read
    // it, and losing them to a refactor is how a batch stops explaining itself.
    extraNote:
      "直接取 HTML 只得到一个词「Qwen」,必须渲染。双数字口径是核对过的而非假设:页面写 GPT-5.6 Sol 的 ALE 为 " +
      "30.6 / 53.6、Opus 4.8 的 OSWorld 2.0 为 20.6 / 54.8,而两个官方榜的归档行正是 30.6 与 20.6," +
      "partial score 53.6 / 54.8。⚠ 注意 OSWorld-Verified 86.1 与 OSWorld 2.0 19.4 是同表两行、差四倍," +
      "只有后者进 osworld2 列。",
    carried: {
      "Terminal Bench 2.1": { id: "terminal", version: "2.1", tools: true },
      "SWE-bench Pro": { id: "swe-pro", version: "Public", tools: true },
      "DeepSWE 1.1": { id: "deepswe", version: "v1.1", tools: true },
      "Agents' Last Exam (Pass / Score)": { id: "ale", version: "ALE-V1", tools: true, dual: "partial-credit score" },
      "Toolathlon Verified (Pass@1)": { id: "toolathlon", version: "Verified", tools: true },
      "HLE w/ tools": { id: "hle-tools", version: "Full", tools: true },
      "GPQA Diamond": { id: "gpqa", version: "Diamond", tools: false },
      HLE: { id: "hle-no-tools", version: "Full", tools: false },
      "MRCR v2 256K (8-needle)": { id: "mrcr", version: "v2 · 8 needle", tools: false, contextLength: "256K" },
      "MMMU-Pro": { id: "mmmu", version: "Pro", tools: false },
      "CharXiv (RQ)": { id: "charxiv", version: "RQ", tools: false, dual: "descriptive-question score" },
      "OSWorld 2.0": { id: "osworld2", version: "2.0", tools: true, dual: "partial score" },
    },
  },
  glm52: {
    label: "GLM-5.2 release",
    maker: "Z.AI",
    // NOT docs.bigmodel.cn. That page is the model card and carries the same claims as prose
    // ("在 FrontierSWE 上仅落后 Opus 4.8 约 1%") with no numbers at all — measured 2026-08-15, its
    // `.md` source is 29KB with zero table rows. The benchmark table is on the blog post, and the
    // blog is a client-rendered shell: fetching it returns 598 bytes.
    url: "https://z.ai/blog/glm-5.2",
    batch: "batch-32-glm52-release",
    batchLabel: "32 · GLM-5.2 release table",
    published: "2026-06-16",
    noteName: "GLM-5.2",
    keep: "GLM-5.2",
    extraNote:
      "星号脚注是页面自己写的:`*: refers to their scores of full set.`,只打在竞品上。核对过它不改变目录口径 —— " +
      "带星的 GPT-5.5 41.4*/52.2* 与目录既有 41.4[Full]/52.2[Full] 逐位相同,不带星的 DeepSeek 37.7/48.2 " +
      "同样等于目录的 37.7/48.2[Full],所以 GLM-5.2 自己那两个不带星的数按 Full 采。" +
      "⚠ 三个标签**故意不映射**,理由各不相同:" +
      "「ProgramBench」63.7 —— 这一列上目录同时holds 官方榜的 0 与 Vals 的 0.5,相差六十多分," +
      "是 TODO 里记着的混指标陷阱,再加一个厂商表的读数不解决任何问题;" +
      "「Terminal Bench 2.1 Best Reported Harness」82.7 (Claude Code) —— 每一格的 harness 不同," +
      "那不是一个可比的列;" +
      "「FrontierSWE Dominance as of 26/6/16」74.4 —— 目录那列是 2026-07 榜,这是六月快照,不同版本。" +
      "另外拒收「MCP-Atlas Public Set」(76.8,与目录 mcp-atlas 的官方 77.8 不是同一个 split)与" +
      "「Tool-Decathlon」(48.2,与目录 toolathlon Verified 的 59.88/59.9 差 20%,不同 split);" +
      "AIME 2026 / HMMT 两行 / NL2Repo 目录没有列。",
    carried: {
      HLE: { id: "hle-no-tools", version: "Full", tools: false },
      "HLE w/ Tools": { id: "hle-tools", version: "Full", tools: true },
      CritPt: { id: "critpt", version: "2026", tools: false },
      IMOAnswerBench: { id: "imo-answer", version: "2026", tools: false },
      "GPQA-Diamond": { id: "gpqa", version: "Diamond", tools: false },
      "SWE-bench Pro": { id: "swe-pro", version: "Public", tools: true },
      DeepSWE: { id: "deepswe", version: "v1.1", tools: true },
      "Terminal Bench 2.1 Terminus-2": { id: "terminal", version: "2.1", tools: true },
      PostTrainBench: { id: "posttrain", version: "v1.1", tools: true },
      "SWE-Marathon": { id: "marathon", version: "v1.1", tools: true },
    },
  },
};

const args = process.argv.slice(2);
const toStdout = args.includes("--stdout");
const requested = args.find((arg) => !arg.startsWith("--"));

if (args.includes("--list") || !requested) {
  console.log("Captured releases:");
  for (const [id, release] of Object.entries(RELEASES)) {
    console.log(`  ${id.padEnd(12)} ${release.maker} · ${release.published} · ${Object.keys(release.carried).length} carried labels`);
  }
  console.log("\nA maker not listed here needs a `carried` map written by someone who read its page.");
  console.log("The release probe (npm run probe:releases) is what tells you a new post exists.");
  process.exit(requested ? 1 : 0);
}

const release = RELEASES[requested];
if (!release) throw new Error(`no captured release "${requested}" — run with --list`);

const EXTRACT = `(() => [...document.querySelectorAll("table")].map((table) =>
  [...table.querySelectorAll("tr")].map((tr) =>
    [...tr.querySelectorAll("th,td")].map((cell) => cell.innerText.trim().replace(/\\s+/g, " ")))))()`;

const browser = await openBrowser();
let tables;
try {
  tables = await browser.evaluate(release.url, EXTRACT, 12000);
} finally {
  browser.close();
}

if (!Array.isArray(tables) || tables.length === 0) throw new Error(`no tables rendered at ${release.url} — the page changed`);

const rows = [];
let section = null;
let sectionsSeen = 0;

for (const table of tables) {
  // The first row names the models. A table whose header has no model columns is a layout table,
  // not results — Qwen's page has one, and it renders as empty cells.
  const header = (table[0] ?? []).map((cell) => cell.trim());
  const models = header.slice(1).filter(Boolean);
  if (models.length === 0) continue;

  // ...and a table can pass that test and still not be results. Z.AI's post opens with a
  // speculative-decoding table (`Method | Acceptance Length`), whose header has a column and whose
  // rows are `Baseline`, `+ IndexShare + KV Share` — read as a results table it archives four rows
  // under a model called "Acceptance Length". A results table for this capture is one that carries
  // at least one label the `carried` map names; nothing else in the post is a model × benchmark
  // grid. Asserted rather than assumed: re-running qwen3.8 through this rule reproduces
  // batch-17 byte for byte, so the rule reads Qwen's page the same way it always did.
  if (!table.some((cells) => release.carried[(cells[0] ?? "").trim()])) continue;

  for (const cells of table.slice(1)) {
    const label = (cells[0] ?? "").trim();
    if (!label) continue;
    // A row with one filled cell is a section heading ("Coding Agent"), not a benchmark.
    if (cells.filter((cell) => cell.trim()).length === 1) { section = label; sectionsSeen += 1; continue; }

    const carried = release.carried[label];
    for (const [index, model] of models.entries()) {
      const published = (cells[index + 1] ?? "").trim();
      // The page writes an unrun cell as "--". It is not a zero and it is not a row.
      if (!published || published === "--" || published === "-- / --") continue;

      const [primary, secondary] = published.split("/").map((part) => part.trim());
      const score = Number(primary);
      if (!Number.isFinite(score)) continue;

      const notes = [`${release.noteName} 发布页「${section ?? "performance"}」分区,原样抄录 ${label} 一行`];
      if (secondary && carried?.dual) notes.push(`${carried.dual} ${secondary}`);
      else if (secondary) notes.push(`页面同格第二个数 ${secondary},语义未标注,未采用`);
      notes.push("厂商发布材料:未标注 harness、reasoning effort 或运行日期");

      rows.push({
        model_raw: model,
        benchmark: carried?.id ?? label,
        benchmark_version: carried?.version ?? null,
        score,
        // Some cells are Elo-like rather than percentages (Qwen's QwenReactBench prints 1694).
        unit: score > 200 ? "Elo" : "%",
        harness: null,
        reasoning_effort: null,
        tools_enabled: carried ? carried.tools : null,
        context_length: carried?.contextLength ?? null,
        evaluation_date: release.published,
        source_label: release.label,
        source_url: release.url,
        source_kind: "vendor",
        note: notes.join(";"),
      });
    }
  }
}

const columns = [...new Set(rows.map((row) => row.model_raw))];
const carriedRows = rows.filter((row) => row.model_raw === release.keep && row.benchmark_version !== null);
const summary = `${rows.length} rows across ${columns.length} published model columns and ` +
  `${new Set(rows.map((row) => row.benchmark)).size} benchmark labels, ${sectionsSeen} sections; ` +
  `${carriedRows.length} of them land in a catalog column`;

const meta = {
  batch: release.batchLabel,
  collectedWith: `scripts/capture-release-tables.mjs ${requested}`,
  filtered: false,
  release: requested,
  sources: [release.url],
  note:
    `${release.label}(${release.published})的性能表,整表抄录:${rows.length} 行,${columns.length} 个已发布模型列,` +
    `${new Set(rows.map((row) => row.benchmark)).size} 个 benchmark 标签,${sectionsSeen} 个分区。页面是客户端渲染的,` +
    `采集脚本用 CDP 驱动无头 Chrome,等应用画完再读表,因此这是可复跑的抓取而不是眼抄。` +
    `厂商发布材料:全表没有标注 harness、reasoning effort 或运行日期,evaluation_date 记的是发布日。` +
    `表里的竞品列一并归档为证据,但只有 ${release.keep} 会被 alias 采纳 —— 竞争对手发布的竞品分数没有 harness、` +
    `effort、版本,源优先级低于任何一个给出这些信息的榜单。双数字格取第一个数为指标、第二个进 note。` +
    `未映射的标签记在 model-aliases.json 的 droppedBenchmarks 里,免得下一代发布时重新推导一遍。` +
    (release.extraNote ? ` ${release.extraNote}` : ""),
  retrievedDate: new Date().toISOString().slice(0, 10),
};

const jsonl = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
if (toStdout) {
  process.stdout.write(jsonl);
  console.error(summary);
} else {
  writeFileSync(join(ROOT, `data/sources/${release.batch}.jsonl`), jsonl);
  writeFileSync(join(ROOT, `data/sources/${release.batch}.meta.json`), JSON.stringify(meta, null, 2) + "\n");
  console.log(`Wrote ${release.batch}: ${summary}`);
}
