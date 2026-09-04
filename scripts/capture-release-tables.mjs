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
  dsv4pro: {
    label: "DeepSeek-V4-Pro-0813 GA release",
    maker: "DeepSeek",
    // NOT the official changelog post. api-docs.deepseek.com/news/news260813 publishes this exact
    // table as a PNG (`/img/v4_260813_benchmark_table_en.png`) — measured 2026-08-17, the page has
    // zero `<table>` elements and its price table is an image too. The same table is the model
    // card's markdown on Hugging Face, which the site server-renders into the page's only table,
    // so this is a re-runnable capture rather than an OCR of a picture.
    url: "https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813",
    batch: "batch-35-deepseek-v4-pro-ga-release",
    batchLabel: "35 · DeepSeek-V4-Pro-0813 GA release table",
    // 34 is the OpenAI repricing batch (PR #93); batch numbers are never reused.
    published: "2026-08-13",
    noteName: "DeepSeek-V4-Pro-0813",
    keep: "DeepSeek-V4-Pro-0813",
    rowNote:
      "厂商发布材料:行上不写 harness / reasoning effort —— 表下 Note 1 只对「code-agent 任务」整体声明了 " +
      "DeepSeek Harness minimal mode 与 max effort,没说哪几行算,摊到行上是判断不是抄录(原文在批次 meta 里);" +
      "运行日期同样未标注,evaluation_date 记的是发布日",
    adoption:
      "这一批的表**不是客户端渲染的**:官方 changelog 那篇把表发成了 PNG,而 Hugging Face 把 model card 的 " +
      "markdown 表格服务端渲染成页面上唯一一个 `<table>`,脚本读的就是它 —— 仍然可复跑,只是不靠等应用画完。" +
      "**2026-08-19 起采纳 GA 那一列**(`DeepSeek-V4-Pro-0813`):记录当天原地翻转成 GA,这批从「为翻转备好的证据」" +
      "变成它的厂商读数。另外七列**仍然全部 file-scoped `modelId: null`** —— 五个竞品列、Flash 的两列。" +
      "⚠ 采纳的是**六格**:hle-no-tools 42.7 · hle-tools 60.0(同一行的第二个数,由 dualColumn 拆行)· " +
      "terminal 87.9 · deepswe 62.7 · toolathlon 74.1 · ale 25.7。其中 terminal 与 Vals 的 GA 读数 54.682 " +
      "相差 61%,裁定写在 model-aliases.json 的 acknowledgedDisagreements 里(是**那一条**,不是这里)。" +
      "⚠ 采纳不改任何已发布数字:`SOURCE_RANK` 把 vendor 排在最后,所以 terminal 仍显示 Vals 的 54.682、" +
      "deepswe 仍显示 DeepSWE 自己的 62.8,厂商读数是同格的第二读数。" +
      "⚠ 其中 `GLM-5.2`、`Kimi K3`、`DeepSeek-V4-Flash-0731` 三个串**有全局通配 alias**,不显式挡住," +
      "厂商发布表的数会直接写进这三条目录记录。" +
      "evaluation_date 记的是发布日;双数字格取第一个数为指标、第二个进 note;" +
      "拒收的标签这次记在下面的 extraNote 里而不是 droppedBenchmarks —— 两条是「目录没这列」、" +
      "两条是厂商自己声明的内部题集,都不该变成一条全局生效的 benchmark 拒收规则。",
    extraNote:
      "交叉验证过这就是 owner 2026-08-12 提供的那张官方发布图:Flash-0731 那一列的九项" +
      "(Terminal 82.7 · NL2Repo 54.2 · Cybergym 76.7 · DeepSWE 54.4 · Toolathlon 70.3 · ALE 25.2 · " +
      "AutomationBench 25.1 · DSBench-FullStack 68.7 · DSBench-Hard 59.6)与官方 changelog 2026-07-31 " +
      "条目逐位相同,Pro-Preview 的 HLE 37.7 与目录既有值也逐位相同。" +
      "⚠ 「HLE (wo / w tools)」一行里装着**目录的两列**:第一个数进 hle-no-tools,第二个数进 hle-tools。" +
      "2026-08-19 之前本脚本每行只出一格,工具档那个数只以原文留在 note 里;现在由 `dualColumn` **拆成第二行**," +
      "所以重跑 capture 会复现这个拆分 —— 手工拆会被下一次重跑抹掉(本脚本覆盖写两个文件)。" +
      "⚠ 表下 Note 1 是这张表罕见地给了脚手架与 effort:「For the code-agent tasks among the public " +
      "benchmarks above, DeepSeek-V4-Pro-0813 is evaluated with the minimal mode of DeepSeek Harness as " +
      "the agent framework, using the `max` reasoning effort level with `temperature = 1.0, top_p = 0.95`.」" +
      "—— 但它没说**哪几行**算 code-agent 任务,把它摊到具体行是判断不是抄录,所以行上仍记 harness / " +
      "reasoning_effort 为 null,原文留在这里。⚠ 这一条有**度量后果**,不只是洁癖:跨源分歧闸门按 " +
      "`harness|effort` 分桶比较,所以 harness/effort 留空的厂商行与 Vals 的 `-|max` 行**不在同一个桶**," +
      "闸门不会去比 87.9 和 54.682。那是闸门的设计(effort 阶梯本来就不该互比,实测 113 个格子同理)," +
      "不是漏洞 —— 但因此**这条分歧只有 acknowledgedDisagreements 里那段文字在记录它**,别把闸门的沉默读成两个数一致。" +
      "拒收四个标签,理由分两种:「NL2Repo」「Cybergym」「AutomationBench (Public)」目录没有这三列;" +
      "「DSBench-FullStack †」「DSBench-Hard †」带的 † 是厂商自己的脚注,原文写明两者都是 internal test set" +
      "(internal full-stack development test set / internal test set of difficult coding-agent problems)," +
      "内部题集没有公开定义可核,永远不该开成列。",
    carried: {
      "HLE (wo / w tools)": {
        id: "hle-no-tools",
        version: "Full",
        tools: false,
        // One published row, two catalog columns. See `dualColumn` in the parser below.
        dualColumn: { id: "hle-tools", version: "Full", tools: true },
      },
      "Terminal Bench 2.1": { id: "terminal", version: "2.1", tools: true },
      DeepSWE: { id: "deepswe", version: "v1.1", tools: true },
      "Toolathlon-Verified": { id: "toolathlon", version: "Verified", tools: true },
      "Agents' Last Exam": { id: "ale", version: "ALE-V1", tools: true },
    },
  },
  qwen37plus: {
    label: "Qwen3.7-Plus release",
    maker: "Alibaba",
    // Discovered 2026-08-26 by direct URL probing: the qwen.ai/research index only lists five
    // cards and has rotated every older post off, so the release probe cannot see this one —
    // it exists, it renders, and it carries the full two-table benchmark grid. The index card
    // rotation means any pre-3.8 Qwen post has to be reached at its blog?id= URL directly.
    url: "https://qwen.ai/blog?id=qwen3.7-plus",
    batch: "batch-38-qwen37plus-release",
    batchLabel: "38 · Qwen3.7-Plus release tables",
    // The page prints its own date: 「2026/06/01 · 44 分钟 · 8818 词」.
    published: "2026-06-01",
    noteName: "Qwen3.7-Plus",
    keep: "Qwen3.7-Plus",
    rowNote:
      "厂商发布材料:harness 与 effort 只在页脚注层面声明、不落到行上(脚注原文在批次 meta 里)," +
      "摊到具体行是判断不是抄录,行上记 null;evaluation_date 记的是发布日",
    adoption:
      "页面客户端渲染,采集脚本用 CDP 驱动无头 Chrome,等应用画完再读表,因此这是可复跑的抓取而不是眼抄。" +
      "⚠ 与 batch 17/32 不同,这一页**在脚注里给了 harness 与 effort 信息**:Terminal 行声明 Harbor/Terminus-2" +
      "(5h 超时、12 CPU/24 GB RAM、temp=1.0、top_p=0.95、top_k=20、max_tokens=80K、256K ctx、5 次平均、" +
      "每轮前置 <think> token);SWE 系列声明「Internal agent scaffold (bash + file-edit tools)」;" +
      "Reasoning 场景给出推荐系统提示「Reasoning effort is set to xhigh」。三者都不说**哪几行**适用," +
      "所以行上仍记 harness/effort 为 null,原文留在这里。表里的竞品列一并归档为证据," +
      "但只有 Qwen3.7-Plus 会被 alias 采纳;「Qwen3.6-Plus」有全局 alias,这里的 file-scoped 拒收是承重的。" +
      "双数字格取第一个数为指标、第二个进 note。未映射的标签记在 model-aliases.json 的 droppedBenchmarks 里," +
      "免得下一代发布时重新推导一遍。",
    extraNote:
      "交叉验证(坑 33,采表前逐格对过目录现值):gpqa 90.3 vs AA 90.0;HLE 34.7 vs AA 35.6;" +
      "IFBench 79.1 vs AA 77.96;SciCode 51.3 vs AA 45.5(12.7%,闸门内)。**身份用竞品列的数字定,不靠串**:" +
      "IMOAnswerBench 的 GLM-5.1 83.8、DeepSeek-V4-Pro 89.8 与 batch 32 逐位相同;" +
      "Apex 的 DeepSeek-V4-Pro 38.3 与目录既有 Epoch 读数逐位相同 —— 两个标签都以此确认是目录同名同口径的列。" +
      "⚠ 「MRCR-v2 128k」:页面只写 v2@128K,**没写针数**;按 MRCR v2 的 8-needle 配置采" +
      "(Qwen 自己在 3.8 发布页把 v2 写作「MRCR v2 256K (8-needle)」,Google 3.6 发布表的 128K 平均分也装在同一列)," +
      "context_length 记 128K,行 note 原样保留页面标签;若 owner 认为针数存疑,翻掉这一条 alias 即可。" +
      "⚠ 「CharXiv(RQ)」双数字口径与 3.8 那篇**不同**:页面自注「BabyVision and CharXiv(RQ): Scores are " +
      "reported as 『with CI / without CI』」—— 第一个数是 with CI,与 3.8 页的「RQ + descriptive」不是一个东西," +
      "note 里带全两个数。⚠ 拒收五个标签,理由在 droppedBenchmarks:SWE-Pro(脚注明说在**修正过的题集**上重测了" +
      "所有基线,且用内部 scaffold,与官方 Public 板不是同一实例)、CritPT(6.0 会落进 Epoch 9.14 的同 null-effort 桶、" +
      "分歧 34%,厂商读数低于独立榜时按源优先级留在档里)、MCP-Atlas(脚注明说 Public set)、" +
      "SWE-Verified(内部 scaffold 读数,DSv4 80.6 vs Vals 96.4 差 ~20%,是 scaffold 差异不是模型差异)、" +
      "MMLU-Pro(是 MMLU-Pro,不是目录 mmmu 列的 MMMU-Pro,一字之差的两个基准)。" +
      "「Terminal Bench 2.0-Terminus」走 terminal|2.0,由 benchmarkSplits 路由到 terminal-20 legacy 列(2.0 与 2.1 " +
      "是不同任务集);「IFEval」不是目录的 ifbench(IFBench)列,同音异基准;「Skillsbench」脚注明说剔掉 9 个" +
      "外部 API 任务后跑 78 个,不是 Vals 那一列的口径。",
    carried: {
      "Terminal Bench 2.0-Terminus": { id: "terminal", version: "2.0", tools: true },
      "GPQA Diamond": { id: "gpqa", version: "Diamond", tools: false },
      HLE: { id: "hle-no-tools", version: "Full", tools: false },
      IMOAnswerBench: { id: "imo-answer", version: "2026", tools: false },
      Apex: { id: "apex", version: "2026", tools: true },
      IFBench: { id: "ifbench", version: "2026", tools: false },
      "MRCR-v2 128k": { id: "mrcr", version: "v2 · 8 needle", tools: false, contextLength: "128K" },
      SciCode: { id: "scicode", version: "2026", tools: false },
      "MMMU-Pro": { id: "mmmu", version: "Pro", tools: false },
      "CharXiv(RQ)": { id: "charxiv", version: "RQ", tools: false, dual: "without-CI score(页面口径 with CI / without CI)" },
    },
  },
  glm53: {
    label: "GLM-5.3 release",
    maker: "Z.AI",
    // The blog post (2026-08-14, "Frontier Coding with Emergent Cyber Capabilities") carries the
    // benchmark table. The docs page docs.bigmodel.cn/cn/guide/models/text/glm-5.3 that the release
    // probe flagged is the model card — same shape as GLM-5.2 (measured 2026-08-15): the card talks
    // prose, the table lives on the blog, and the blog is a client-rendered shell.
    url: "https://z.ai/blog/glm-5.3",
    batch: "batch-36-glm53-release",
    batchLabel: "36 · GLM-5.3 release table",
    published: "2026-08-14",
    noteName: "GLM-5.3",
    keep: "GLM-5.3",
    rowNote:
      "厂商发布材料:行上不写 harness / 运行日期 —— 页面另有一张参数表声明 API 默认 " +
      "reasoning_effort=max(thinking 恒开,disabled 不再支持),但那是服务默认不是评测设定," +
      "摊到具体行上是判断不是抄录,所以行上仍记 null,原文在批次 meta 里;evaluation_date 记的是发布日",
    adoption:
      "页面客户端渲染,采集脚本用 CDP 驱动无头 Chrome,等应用画完再读表,因此这是可复跑的抓取而不是眼抄。" +
      "⚠ 本批次**一个模型列都不采纳,包括 GLM-5.3 自己**:目录还没有 glm-5.3 记录," +
      "而证据计数器按设计整批排除 release-capture,一张厂商表永远不可能自己把新模型抬过收录地板 —— " +
      "这批是为独立榜测到 GLM-5.3 那天备好的证据(同 batch 35 的立场)。" +
      "GLM-5.2 / Kimi K3 / Qwen3.8-Max / Opus 4.8 / GPT-5.6 Sol 五个串**有全局 alias**," +
      "这里的 file-scoped 拒收是承重的:不写,竞品分数会直接写进这五条目录记录。" +
      "DeepSeek-V4 Pro-0813 与 Fable 5 (w/ fallback) 无全局 alias,仍写显式拒收," +
      "让未来任何全局 alias 都必须先抬起这条才会生效。evaluation_date 记的是发布日;" +
      "双数字格取第一个数为指标、第二个进 note。",
    extraNote:
      "交叉验证(坑 33,采表前逐格对过目录现值):HLE w/ Tools 的 GLM-5.2 列 54.7 与 batch 32 逐位相同;" +
      "DeepSWE 46.2、Toolathlon Verified 59.9 逐位相同;FrontierSWE 两格印证" +
      "(GLM-5.2 67.5 vs 目录 67.3、Opus 4.8 66.5 vs 66.7)说明读的就是目录 frontierswe 列那块 2026-07 的板 —— " +
      "batch 32 拒收的那次是六月快照(GLM-5.2 打到 74.4),这次不是,所以这次采纳;" +
      "GDPval-AA 1508 vs 目录 1510 是 AA 活 Elo 的正常漂移。⚠ 「Agents' Last Exam ALE-CLI」**拒绝映射**:" +
      "Qwen3.8-Max 27.0 与官方 26.97 吻合,但 GPT-5.6 Sol 28.6 vs 官方 30.59、GLM-5.2 23.8 vs 官方 20.39 都对不上 —— " +
      "ALE-CLI 是 ALE 的 CLI 子赛道,不是 ale 列的口径(坑 3 同形:同名不同 split)," +
      "已在 droppedBenchmarks 立条。「Terminal Bench 3.0」目录 terminal 列只装 2.1,3.0 是另一个版本" +
      "(GLM-5.2 在 3.0 上 4.6、在 2.1 上 81.0,版本即全部差异),留档不映射。" +
      "「ProgramBench Almost Solved」是 program 列混指标坑(TODO 未决)上的第三种计分:" +
      "GLM-5.2 这里 9.5,batch 32 拒收的 dominance 口径是 63.7 —— 维持拒收。" +
      "NL2Repo 已在 droppedBenchmarks;CyberGym / ExploitGym 2h/6h / ExploitBench / AutomationBench v1.0.6 目录无列,留档。" +
      "另外页面明说 GLM-5.3 与 GLM-5.2 **同一基座、全部增益来自 post-training**," +
      "且权重「上线两周后开源」—— 将来立记录时的身份与 open 判断以此为准。",
    carried: {
      "Terminal Bench 2.1": { id: "terminal", version: "2.1", tools: true },
      "DeepSWE v1.1": { id: "deepswe", version: "v1.1", tools: true },
      FrontierSWE: { id: "frontierswe", version: "2026-07", tools: true },
      "SWE-Marathon v1.1": { id: "marathon", version: "v1.1", tools: true },
      PostTrainBench: { id: "posttrain", version: "v1.1", tools: true },
      "Toolathlon Verified": { id: "toolathlon", version: "Verified", tools: true },
      "HLE w/ Tools": { id: "hle-tools", version: "Full", tools: true },
      "GDPval-AA v2": { id: "gdpval", version: "v2", tools: true },
    },
  },
  kimik3: {
    label: "Kimi K3 release",
    maker: "Moonshot AI",
    // The GitHub README is the maker's published table and it is static server-rendered markdown —
    // no CDP wait needed, though openBrowser's evaluate works on it the same way. The kimi.com blog
    // post carries the same table; the README is the one that also survives as a git history.
    // NOT the HF model card: its benchmark table is a JPEG (figures/benchmark.jpeg), and
    // .eval_results/minimax-m3.yaml-style structured files do not exist for K3 (checked 2026-08-30:
    // the card has eval-results dataset metadata, not a benchmark table).
    url: "https://github.com/MoonshotAI/Kimi-K3",
    batch: "batch-39-kimik3-release",
    batchLabel: "39 · Kimi K3 release table",
    published: "2026-07-23",
    noteName: "Kimi K3",
    keep: "Kimi K3 (max)",
    effort: "max",
    // This page states harnesses and effort — the first release table this catalog captured that
    // does. So rowNote says the opposite of the house default, and the row builder below uses
    // `harnessByLabel` to put them on the rows instead of null.
    rowNote:
      "厂商发布材料:脚注声明所有 Kimi K3 结果 reasoning effort=max、temperature=1.0;" +
      "带工具任务用 Kimi Code 脚手架(具体到行,见脚注 2/3);evaluation_date 记的是发布日",
    adoption:
      "GitHub README 是静态服务端渲染 markdown,采集脚本读表仍走 CDP 但无需等应用画完,因此这是可复跑的抓取。" +
      "⚠ 与此前所有 release capture 不同,这张表**在脚注里声明了 harness 与 effort**,并具体到行组:" +
      "Kimi K3 自己列全部 effort=max;DeepSWE/Terminal/ProgramBench/SWE-Marathon/PostTrainBench 用 Kimi Code;" +
      "所以本批采纳行的 harness/effort 不再记 null(行生成器为此加了 carried.harness 与 release.effort)。" +
      "**只采纳 Kimi K3 (max) 自己列里 Moonshot 自己测的 13 个标签**(HLE-Full 一行拆两列,共 14 行);" +
      "五个竞品列 file-scoped 拒收(与 batch 17/32/38 一致)。**八个标签虽然目录有列、仍然拒收**,理由分三種,记在 extraNote:" +
      "六个是脚注明说的**转引**(cited from AA/官方榜 as of July 23 —— 往 Exact 的原生行旁边放一条四舍五入的厂商孪生," +
      "正是 supersededRows 机制要防的「同一测量读两遍」);一个是 **split 不匹配**;一个是**改过的题集**。" +
      "**双数字格**:页面自注 MMMU-Pro/CharXiv(MathVision/ZeroBench/HLE 同)每格报「无工具 / 有工具」两数," +
      "第一个数进主列,第二个数只进 note(目录没有这些基准的 with-tools 列);" +
      "HLE-Full 例外:它的两个数**正好是目录两列**(hle-no-tools/hle-tools),按 dualColumn 拆行。",
    extraNote:
      "交叉验证(坑 33,采表前逐格对过目录现值):gpqa 93.5 与 AA 既有读数一致;ale 28.3 = 官方榜 28.29 的四舍五入;" +
      "gdpval 1686 vs AA 活 Elo 1668 属正常漂移;toolathlon 76.5 vs 官方 76.54 同 —— 这两组近恒等正是脚注「cited from」的指纹," +
      "所以那两行按转拒。⚠ deepswe 67.5 是 Kimi Code 脚手架的自测,官方榜同模型 mini-SWE-agent 67.3/另列 68.5 —— " +
      "多 harness 同格是设计内多行,主显仍 benchmark 原生。⚠ frontierswe 81.2 脚注明说 Dominance as of July 16," +
      "与目录列 2026-07 口径一致(batch 36 同判)。⚠ PostTrainBench 36.6:官方 Harbor 实现、H20 而非 H100、三次平均 —— " +
      "harness 与题集都是官方的,硬件偏差留在本 note。⚠ BrowseComp 91.2 带 300K context-compaction 策略," +
      "全 1M 无管理时 90.4(脚注原文)。⚠ SWE-Marathon 拒收:脚注明说基于官方任务的 **H20-calibrated 分支**、在最终 v1.1 之前," +
      "Docker 镜像/性能门槛/参考 oracle 都为 H20 重校过 —— 修正过的题集不是官方 v1.1 实例(batch 38 拒 SWE-Pro 同判)," +
      "且 droppedBenchmarks 是全局标签机制、会误杀 batch 32 的 GLM 行,所以按 batch 35 先例记在这里。" +
      "⚠ MCP-Atlas 拒收:脚注明说 500-task public subset、100-turn、Gemini 3.1 Pro 裁判,与官方 1,000-task 全集不是同一实例" +
      "(batch 38 拒「MCP-Atlas Public Set」同判;官方 82.3 行已在格)。⚠ 六个转引标签拒收:CritPt/AA-LCR/SciCode(引 AA)、" +
      "GDPval-AA/APEX(引 AA 与 APEX 榜)、Agents' Last Exam(引官方榜)—— 目录已持这些榜的原生行," +
      "厂商表里的四舍五入副本不添信息。⚠ 双数字口径:MMMU-Pro/CharXiv 每格「without / with tool augmentation」," +
      "与 Qwen3.8 页同形,第一个数入列。其余无列标签(DeepSearchQA/ResearchRubrics/MCPMark/JobBench/AA-Briefcase/" +
      "OfficeQA Pro/SpreadsheetBench 2/SaaS-Bench/Harvey Lab-AA/CorpFin/Finance Agent/Legal Research/WorldVQA/" +
      "PerceptionBench/Video-MME/MMVU/BabyVision/MathVision/ZeroBench/Kimi Code Bench 2.0/MLS-Bench-Lite/OSWorld-Verified)" +
      "照常留档;Vals 系五条脚注明说转引 Vals AI,τ³/Harvey 引 AA,同转引理由。",

    carried: {
      "GPQA Diamond": { id: "gpqa", version: "Diamond", tools: false },
      "HLE-Full": {
        id: "hle-no-tools",
        version: "Full",
        tools: false,
        dualColumn: { id: "hle-tools", version: "Full", tools: true, harness: "Kimi Code" },
      },
      DeepSWE: { id: "deepswe", version: "v1.1", tools: true, harness: "Kimi Code" },
      ProgramBench: { id: "program", version: "2026", tools: true, harness: "Kimi Code" },
      "Terminal-Bench 2.1": { id: "terminal", version: "2.1", tools: true, harness: "Kimi Code" },
      FrontierSWE: { id: "frontierswe", version: "2026-07", tools: true, harness: "Kimi Code" },
      PostTrainBench: { id: "posttrain", version: "v1.1", tools: true, harness: "Kimi Code" },
      BrowseComp: { id: "browsecomp", version: "2026", tools: true },
      "Toolathlon-Verified": { id: "toolathlon", version: "Verified", tools: true },
      "OSWorld 2.0": { id: "osworld2", version: "2.0", tools: true },
      OmniDocBench: { id: "omnidoc", version: "1.5", tools: false },
      "MMMU-Pro": { id: "mmmu", version: "Pro", tools: false, dual: "with-python score(页面口径 without / with)" },
      "CharXiv (RQ)": { id: "charxiv", version: "RQ", tools: false, dual: "with-python score(页面口径 without / with)" },
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

      const baseNote = `${release.noteName} 发布页「${section ?? "performance"}」分区,原样抄录 ${label} 一行`;
      // Every release so far states no harness and no effort, so the row says so. A release that
      // states them says something else — the row is the evidence, and a sentence that is false on
      // every row is worse than the same sentence being false once in the meta.
      const tailNote = release.rowNote ?? "厂商发布材料:未标注 harness、reasoning effort 或运行日期";
      const emit = (value, column, notes) => rows.push({
        model_raw: model,
        benchmark: column?.id ?? label,
        benchmark_version: column?.version ?? null,
        score: value,
        // Some cells are Elo-like rather than percentages (Qwen's QwenReactBench prints 1694).
        unit: value > 200 ? "Elo" : "%",
        harness: column?.harness ?? null,
        reasoning_effort: release.effort ?? null,
        tools_enabled: column ? column.tools : null,
        context_length: column?.contextLength ?? null,
        evaluation_date: release.published,
        source_label: release.label,
        source_url: release.url,
        source_kind: "vendor",
        note: [baseNote, ...notes, tailNote].join(";"),
      });

      // `dualColumn` is for the shape where ONE published row carries TWO catalog columns —
      // DeepSeek prints "HLE (wo / w tools)" as a single row with two numbers, where Qwen and Z.AI
      // print two rows. Without it the second number survives only as prose in a note, which is
      // archived-but-uncountable: batch 35's own meta had to promise "采纳那天要把它拆成第二行",
      // and a hand-split would have been erased by the next `capture:release` run, because this
      // script overwrites both files. Emitting it here keeps the split reproducible.
      // ⚠ Only for a second number whose COLUMN is known. Where the second figure is a different
      // metric of the same column (Qwen's partial-credit scores, OSWorld's partial score) it stays
      // a note — `dual` — because the catalog has nowhere to put it.
      const secondScore = secondary === undefined ? NaN : Number(secondary);
      if (carried?.dualColumn && Number.isFinite(secondScore)) {
        emit(score, carried, [`同格第二个数 ${secondary} 已按 ${carried.dualColumn.id} 单独出行`]);
        emit(secondScore, carried.dualColumn, [
          `${label} 一行的第二个数(第一个数 ${primary} 在 ${carried.id});` +
          `同一行装着目录两列,拆行由 capture 脚本的 dualColumn 完成,不是手工补的`,
        ]);
        continue;
      }
      if (secondary && carried?.dual) emit(score, carried, [`${carried.dual} ${secondary}`]);
      else if (secondary) emit(score, carried, [`页面同格第二个数 ${secondary},语义未标注,未采用`]);
      else emit(score, carried, []);
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
    `${new Set(rows.map((row) => row.benchmark)).size} 个 benchmark 标签,${sectionsSeen} 个分区。` +
    // The house sentences below are true of every release captured so far: the page renders client
    // side, the vendor states no harness, only `keep` is adopted, refusals go to droppedBenchmarks.
    // A release that breaks any of them replaces the whole block via `adoption` rather than being
    // described by a generated sentence that is false about its own batch — a meta is evidence
    // about evidence, and this template has no way to be half-true.
    (release.adoption ??
      `页面是客户端渲染的,采集脚本用 CDP 驱动无头 Chrome,等应用画完再读表,因此这是可复跑的抓取而不是眼抄。` +
        `厂商发布材料:全表没有标注 harness、reasoning effort 或运行日期,evaluation_date 记的是发布日。` +
        `表里的竞品列一并归档为证据,但只有 ${release.keep} 会被 alias 采纳 —— 竞争对手发布的竞品分数没有 harness、` +
        `effort、版本,源优先级低于任何一个给出这些信息的榜单。双数字格取第一个数为指标、第二个进 note。` +
        `未映射的标签记在 model-aliases.json 的 droppedBenchmarks 里,免得下一代发布时重新推导一遍。`) +
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
