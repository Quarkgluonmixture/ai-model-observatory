# 数据采集 Prompt

每个批次都是**自包含**的：整段复制粘给带浏览的 GPT 即可，不需要拼接。
一次只跑一个批次。返回的 ```jsonl 原样贴回来入库。

批次 1–9 已完成，存档在 `data/sources/`。目前 `npm run check:models` 报 98% 有出处，
`npm run check:data` 报 47.2% 格子覆盖率。

**开新批次前先找数据文件，别急着雇转写员。** 批次 9（LiveBench）不在这份文件里，因为它
根本不需要浏览模型：LiveBench 是客户端渲染的，批次 5 曾因此记成 UNAVAILABLE，但那个页面
自己会去拉 `table_<release>.csv`，`scripts/fetch-livebench.mjs` 直接读它。脚本批次在每个
维度上都更好 —— 没有行数上限、没有转写错误，而且重跑一次就是上游漂移检查
（`npm run check:upstream`）。只有确认拿不到数据文件时，才回到下面的转写合同。

---

## 批次 2 · 编程与软件工程

````
你是基准测试数据采集员。任务是**从公开排行榜逐行抄录已发布的评测结果**，输出 JSONL。
这是抄录任务，不是估计任务。

## 硬性规则

1. **只抄，不猜。** 每个数字必须是你在页面上真实看到的。页面没有的格子就不要输出那一行。
   禁止插值、推断、"根据同系列推测"、"大约"、或从别处搬近似值。
2. **必须展开全部行。** 遇到 "Show more" / "Load more" / 分页 / 折叠区，全部展开后再抄。
   抄完后用 `# ROWCOUNT: <url> — 可见 N 行，已抄录 M 行` 自查，N≠M 要说明原因。
3. **每行带精确来源 URL**（能看到这个数字的那一页，不是站点首页）。
4. **不同配置绝不合并。** 同一模型在同一 benchmark 上有多行（不同 harness / effort /
   工具开关 / 上下文长度 / benchmark 版本），**每行单独输出**。不要取最大值或平均值。
5. **版本不同 = 不同的行。** 例如 Terminal-Bench 2.0 与 2.1、SWE-bench Verified 与 Lite，
   必须分开抄，`benchmark_version` 如实填写。
6. **保留原始模型字符串。** `model_raw` 原样照抄（含 "(high)"、"thinking"、"-preview"、
   日期后缀）。不要规范化或翻译。
7. **本批次全是系统级成绩，`harness` 是必填项。** 分数来自哪个 agent/scaffold
   （Claude Code、Codex、Terminus 2、mini-SWE-agent、Gemini CLI、OpenHands、Cursor CLI…）
   必须写清楚。如果页面确实没写 harness，在 note 里注明"页面未标注 harness"。
8. **effort 标注价值极高。** 页面若标了 (high)/(xhigh)/(max)/(thinking)，一定要抄进
   `reasoning_effort`。页面没标就填 null，不要替我推断。
9. 来源优先级：benchmark 官方榜 > 独立第三方 > 厂商页。`source_kind` 如实标注。
10. 页面打不开/需登录/表格空 → 用 `# UNAVAILABLE: <url> — 原因` 说明，不要编数据填补。
    URL 若 404，可以去找该 benchmark 的官方替代页（论文表格/官网/HF），并注明你换了源。

## 本批次的 benchmark id（只用这些，不要自创）

  terminal       Terminal-Bench（2.1 与 2.0 分开抄）
  swe-verified   SWE-bench Verified
  swe-pro        SWE-Bench Pro
  swe-evo        SWE-EVO
  deepswe        DeepSWE
  marathon       SWE-Marathon
  frontierswe    FrontierSWE
  posttrain      PostTrainBench
  program        ProgramBench
  scicode        SciCode

## 要抄的页面

  https://www.tbench.ai/leaderboard/terminal-bench/2.1
  https://www.tbench.ai/leaderboard/terminal-bench/2.0
  https://www.swebench.com/                          （Verified / Lite / Full / Multimodal / Multilingual 每个 tab 都要）
  https://labs.scale.com/leaderboard/swe_bench_pro_public
  https://github.com/SWE-EVO/SWE-EVO
  https://deepswe.datacurve.ai/
  https://www.swe-marathon.org/
  https://www.frontierswe.com/
  https://posttrainbench.com/
  https://github.com/facebookresearch/programbench
  https://scicode-bench.github.io/
  https://livebench.ai/                              （coding 与 agentic coding 两列，source_kind=independent）

## 输出格式

先输出一个 ```jsonl 代码块，每行一个对象，字段固定：

{"model_raw":"Fable 5","benchmark":"terminal","benchmark_version":"2.1","score":83.8,"unit":"%","harness":"Claude Code","reasoning_effort":null,"tools_enabled":true,"context_length":null,"evaluation_date":"2026-06-07","source_label":"Terminal-Bench 2.1 official leaderboard","source_url":"https://www.tbench.ai/leaderboard/terminal-bench/2.1","source_kind":"benchmark","note":"±1.2"}

- `score` 数字不带百分号，保留页面上的小数位；`unit` 用 "%" 或 "Elo"
- `tools_enabled` 用 true/false/null，页面没说就 null，不要默认 false
- `evaluation_date` 用 ISO `YYYY-MM-DD`；页面没有日期就填 null（不要拿今天的日期充数）
- `source_kind` 用 "benchmark" / "independent" / "vendor"
- `note` 写任何影响可比性的信息：±误差、pass@1 vs pass@k、子集、n 次平均、尝试次数、预算

JSONL 之后再输出纯文本：
  `# ROWCOUNT:` 每个 URL 的 可见行数 vs 已抄录行数
  `# COVERED:` 成功抄录的 URL
  `# UNAVAILABLE:` 打不开/无数据的 URL 及原因
  `# AMBIGUOUS:` 你拿不准所以故意丢弃的行，各写一句为什么

不要写总结、分析、排名点评或建议。只要数据。
````

---

## 批次 3 · Agent 与工具使用

````
你是基准测试数据采集员。任务是**从公开排行榜逐行抄录已发布的评测结果**，输出 JSONL。
这是抄录任务，不是估计任务。

## 硬性规则

1. **只抄，不猜。** 每个数字必须是你在页面上真实看到的。页面没有的格子就不要输出那一行。
   禁止插值、推断、"根据同系列推测"、"大约"、或从别处搬近似值。
2. **必须展开全部行。** 遇到 "Show more" / "Load more" / 分页 / 折叠区，全部展开后再抄。
   抄完后用 `# ROWCOUNT: <url> — 可见 N 行，已抄录 M 行` 自查，N≠M 要说明原因。
3. **每行带精确来源 URL**（能看到这个数字的那一页，不是站点首页）。
4. **不同配置绝不合并。** 同一模型有多行（不同 harness / effort / 工具开关 / 上下文长度 /
   benchmark 版本），**每行单独输出**。不要取最大值或平均值。
5. **OSWorld 的版本必须分清楚。** OSWorld 1.0 / OSWorld-Verified / OSWorld 2.0 是不同的
   评测集，写进 `benchmark_version`，绝不合并。步数上限（15 步 / 50 步）写进 note。
6. **保留原始模型字符串。** `model_raw` 原样照抄，不要规范化或翻译。
7. **本批次全是系统级成绩，`harness` 是必填项。** 分数来自哪个 agent/scaffold 必须写清楚。
   页面确实没写就在 note 里注明"页面未标注 harness"。
8. **effort 标注价值极高。** 页面标了 (high)/(xhigh)/(max) 就抄进 `reasoning_effort`，
   没标填 null，不要替我推断。
9. 来源优先级：benchmark 官方榜 > 独立第三方 > 厂商页。`source_kind` 如实标注。
10. 页面打不开/需登录/表格空 → 用 `# UNAVAILABLE: <url> — 原因` 说明，不要编数据填补。
    URL 若 404 或跳转，去找官方替代页并注明你换了源。

## 本批次的 benchmark id（只用这些，不要自创）

  mcp-atlas      MCP-Atlas
  toolathlon     Toolathlon
  osworld2       OSWorld（1.0 / Verified / 2.0 用 benchmark_version 区分）
  browsecomp     BrowseComp
  ale            Agents' Last Exam
  hle-tools      Humanity's Last Exam，**开启工具/检索**的成绩

## 要抄的页面

  https://labs.scale.com/leaderboard/mcp_atlas
  https://github.com/scaleapi/mcp-atlas
  https://github.com/hkust-nlp/Toolathlon
  http://osworld-v1.xlang.ai/
  https://os-world.github.io/
  https://agents-last-exam.org/
  https://openai.com/index/browsecomp/
  https://lastexam.ai/            （注意：带工具的榜区之前一直卡在 "Loading HLE results..."，
                                    若仍加载不出来就报 UNAVAILABLE，不要用无工具分数顶替）

## 输出格式

先输出一个 ```jsonl 代码块，每行一个对象，字段固定：

{"model_raw":"Claude Opus 5","benchmark":"osworld2","benchmark_version":"2.0","score":66.1,"unit":"%","harness":"Claude Code","reasoning_effort":"max","tools_enabled":true,"context_length":null,"evaluation_date":"2026-07-09","source_label":"OSWorld official leaderboard","source_url":"http://osworld-v1.xlang.ai/","source_kind":"benchmark","note":"50-step budget"}

- `score` 数字不带百分号，保留小数位；`unit` 用 "%" 或 "Elo"
- `tools_enabled` 用 true/false/null，页面没说就 null
- `evaluation_date` 用 ISO `YYYY-MM-DD`；没有就填 null（不要拿今天的日期充数）
- `source_kind` 用 "benchmark" / "independent" / "vendor"
- `note` 写影响可比性的信息：步数上限、尝试次数、子集、n 次平均、±误差

JSONL 之后再输出纯文本：`# ROWCOUNT:` / `# COVERED:` / `# UNAVAILABLE:` / `# AMBIGUOUS:`

不要写总结、分析、排名点评或建议。只要数据。
````

---

## 批次 4 · 多模态 · 长上下文 · 专业工作

````
你是基准测试数据采集员。任务是**从公开排行榜逐行抄录已发布的评测结果**，输出 JSONL。
这是抄录任务，不是估计任务。

## 硬性规则

1. **只抄，不猜。** 每个数字必须是你在页面上真实看到的。页面没有的格子就不要输出那一行。
   禁止插值、推断、"根据同系列推测"、"大约"、或从别处搬近似值。
2. **必须展开全部行。** 遇到 "Show more" / "Load more" / 分页 / 折叠区，全部展开后再抄。
   抄完后用 `# ROWCOUNT: <url> — 可见 N 行，已抄录 M 行` 自查，N≠M 要说明原因。
3. **每行带精确来源 URL**（能看到这个数字的那一页，不是站点首页）。
4. **MRCR 必须填 `context_length`。** "128K average" 与 "1M pointwise" 是完全不同的结果，
   绝不合并，各自单独一行。needle 数（8 needle 等）写进 `benchmark_version`。
5. **GDPval-AA 是 Elo 分**，`unit` 填 "Elo"，不要换算成百分比。
6. **MMMU 要分清 MMMU 与 MMMU-Pro**，只抄 Pro；若页面同时有 Standard/Vision 子集，
   用 `benchmark_version` 区分并各自成行。
7. **保留原始模型字符串。** `model_raw` 原样照抄，不要规范化或翻译。
8. **effort 标注价值极高。** 页面标了 (high)/(xhigh)/(max)/(thinking) 就抄进
   `reasoning_effort`，没标填 null，不要替我推断。
9. 纯模型评测（MMMU、CharXiv、VideoMMMU、MMLU-Pro、MRCR）`harness` 填 null；
   系统级评测（GDPval-AA、APEX-Agents）若有 scaffold 必须写 `harness`。
10. 来源优先级：benchmark 官方榜 > 独立第三方 > 厂商页。`source_kind` 如实标注。
11. 页面打不开/需登录/表格空 → `# UNAVAILABLE: <url> — 原因`，不要编数据填补。
    URL 若 404，去找官方替代页（论文表格/官网/HF Space）并注明你换了源。

## 本批次的 benchmark id（只用这些，不要自创）

  mmmu           MMMU-Pro
  charxiv        CharXiv Reasoning Questions
  videommmu      VideoMMMU
  omnidoc        OmniDocBench
  aa-lcr         Artificial Analysis Long Context Reasoning
  mrcr           MRCR（context_length 必填）
  gdpval         GDPval-AA（unit=Elo）
  apex           APEX-Agents
  mmlu-pro       MMLU-Pro

## 要抄的页面

  https://mmmu-benchmark.github.io/
  https://charxiv.github.io/
  https://videommmu.github.io/
  https://github.com/opendatalab/OmniDocBench
  https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning
  https://artificialanalysis.ai/evaluations/gdpval-aa
  https://huggingface.co/datasets/openai/mrcr
  https://www.mercor.com/apex/apex-agents-leaderboard/
  https://huggingface.co/spaces/TIGER-Lab/MMLU-Pro

## 输出格式

先输出一个 ```jsonl 代码块，每行一个对象，字段固定：

{"model_raw":"Gemini 3.6 Flash","benchmark":"mrcr","benchmark_version":"v2 · 8 needle","score":91.8,"unit":"%","harness":null,"reasoning_effort":null,"tools_enabled":false,"context_length":"128K average","evaluation_date":null,"source_label":"OpenAI MRCR dataset card","source_url":"https://huggingface.co/datasets/openai/mrcr","source_kind":"benchmark","note":"页面未发布评测日期"}

- `score` 数字不带百分号，保留小数位；Elo 就填 Elo 数值
- `tools_enabled` 用 true/false/null，页面没说就 null
- `evaluation_date` 用 ISO `YYYY-MM-DD`；没有就填 null（不要拿今天的日期充数）
- `source_kind` 用 "benchmark" / "independent" / "vendor"
- `note` 写影响可比性的信息：子集、评分方式、±误差、评委模型

JSONL 之后再输出纯文本：`# ROWCOUNT:` / `# COVERED:` / `# UNAVAILABLE:` / `# AMBIGUOUS:`

不要写总结、分析、排名点评或建议。只要数据。
````

---

## 批次 5 · 独立评测机构

````
你是基准测试数据采集员。任务是**从独立第三方评测机构的排行榜逐行抄录已发布的结果**，
输出 JSONL。这是抄录任务，不是估计任务。

## 硬性规则

1. **只抄，不猜。** 每个数字必须是你在页面上真实看到的。页面没有的格子就不要输出那一行。
   禁止插值、推断、"根据同系列推测"、"大约"、或从别处搬近似值。
2. **必须展开全部行，并逐个打开子页面。** Vals AI 每个 benchmark 有独立子页，
   总表只给聚合分，**必须点进每个子页抄具体分数**。遇到 "Show more"/分页全部展开。
   抄完后用 `# ROWCOUNT: <url> — 可见 N 行，已抄录 M 行` 自查。
3. **每行带精确来源 URL**（具体那个 benchmark 子页，不是站点首页）。
4. **本批次 `source_kind` 全部填 "independent"。**
5. **benchmark id 用你自己起的稳定 slug**，规则：机构前缀 + benchmark 名，小写连字符。
   例：`vals-corpfin`、`vals-legal-research`、`vals-finance-agent`、`vals-medcode`、
   `aa-intelligence-index`、`livebench-agentic-coding`、`arena-text`、`arena-webdev`。
   在 note 里用一句话写清**评测对象是什么、怎么打分**（这决定它能不能进能力雷达）。
6. **Arena 是人类偏好 Elo，不是任务准确率。** `unit` 填 "Elo"，note 里写明投票数与时间窗。
7. **保留原始模型字符串。** `model_raw` 原样照抄，不要规范化或翻译。
8. **effort 标注价值极高。** 页面标了 (high)/(xhigh)/(max) 就抄进 `reasoning_effort`。
9. 页面打不开/需登录/表格空 → `# UNAVAILABLE: <url> — 原因`，不要编数据填补。

## 要抄的页面

  https://www.vals.ai/home                          （先抄总表，再逐个打开下面每个子页）
  https://www.vals.ai/benchmarks                    （子页索引）
  https://artificialanalysis.ai/leaderboards/models （Intelligence Index + 各分项列）
  https://livebench.ai/                             （global average + 每个分项列各自成行）
  https://lmarena.ai/leaderboard/text
  https://lmarena.ai/leaderboard/webdev

Vals AI 子页至少覆盖这些（有多少抄多少）：SWE-bench Verified、IOI、Code Migration、
ProgramBench、CorpFin v2、Finance Agent v2、Legal Research Bench、MedCode、MedScribe、
MortgageTax、Public Benefits Bench、MMLU Pro、MMMU、ProofBench、Terminal-Bench 2.1、
Vibe Code Bench、LiveCodeBench、Web Search Index、CyberBench、GPQA Diamond、SkillsBench。

## 输出格式

先输出一个 ```jsonl 代码块，每行一个对象，字段固定：

{"model_raw":"Claude Fable 5","benchmark":"vals-corpfin","benchmark_version":"v2","score":75.14,"unit":"%","harness":null,"reasoning_effort":null,"tools_enabled":null,"context_length":null,"evaluation_date":"2026-07-20","source_label":"Vals AI CorpFin v2 leaderboard","source_url":"https://www.vals.ai/benchmarks/corpfin","source_kind":"independent","note":"评测对象：企业财报问答；打分：与标准答案比对的准确率"}

- `score` 数字不带百分号，保留小数位；Elo 就填 Elo 数值
- `evaluation_date` 用 ISO `YYYY-MM-DD`；没有就填 null（不要拿今天的日期充数）
- `note` 必写：评测对象 + 打分方式

JSONL 之后再输出纯文本：`# ROWCOUNT:` / `# COVERED:` / `# UNAVAILABLE:` / `# AMBIGUOUS:`
另外用 `# NEWIDS:` 列出你新起的所有 benchmark id 及其一句话定义。

不要写总结、分析、排名点评或建议。只要数据。
````

---

## 回来之后

把 GPT 输出的 ```jsonl 块**原样**贴回来。入库流程：

1. 原始行逐字存进 `data/sources/batch-0N-*.jsonl` + 同名 `.meta.json`（记录抓取日期）
2. 在 `data/model-aliases.json` 增加映射决策，每条带理由
3. `npm run ingest` — 没有 alias 的行会被跳过并打印，不会被猜进去
4. `npm run lint && npm run check:data && npm run build`

### 已知的模型名歧义（入库时会挡下来，不要让 GPT 替我们决定）

仓库 model id 把 reasoning effort 编进了 id（`gpt-5.6-terra-max` / `-xhigh`），
而多数榜只写 `GPT-5.6 Terra`。所以：

- 页面**有** effort 标注 → 能直接落到具体 id，这类行价值最高
- 页面**没有** effort 标注 → `reasoning_effort` 填 null，由我们决定怎么挂
- `GPT-5.5 Pro` / `GPT-5.2 Pro` / `GPT-5.4 Pro` 是与基础版不同的模型，不要混

---

## 批次 6 · 模型运营数据（与前五批格式不同）

> 前五批抄的是 **benchmark 成绩**；这一批抄的是 **模型本身的运营参数**（智能指数、价格、
> 速度、延迟、上下文、Elo）。目的是让 12 个已有成绩但尚未收录的当前世代模型能进目录。

````
你是模型参数采集员。任务是**从公开页面逐行抄录模型的运营参数**，输出 JSONL。
这是抄录任务，不是估计任务。

## 硬性规则

1. **只抄，不猜。** 每个数字必须是你在页面上真实看到的。没有的字段填 null。
   绝对不要用同系列模型推算价格、速度或指数。宁可整行不输出，也不要填近似值。
2. **必须展开全部行。** Artificial Analysis 的模型榜之前只渲染出 5 行就停了。这次必须
   展开完整表格（滚动 / "Show more" / 分页），或者逐个打开每个模型的详情页。
   抄完后用 `# ROWCOUNT: <url> — 可见 N 行，已抄录 M 行` 自查。
3. **effort 是独立的一行。** Artificial Analysis 会把同一个模型的不同 reasoning effort
   列成多行（如 "GPT-5.6 Sol (max)" / "(xhigh)" / "(high)"），**每个 effort 单独输出一行**，
   不要只取最强的那个。页面没有 effort 标注就填 null。
4. **价格单位统一为「每百万 token 的美元数」。** 如果页面用的是每千 token，换算后在 note
   里写明你换算过。缓存价没有就 null，不要用 input/10 之类的规则推算。
5. **一行一个来源。** 同一个模型的 AA 数据和 Arena Elo 来自不同页面，就输出两行，
   各自带自己的 source_url，未覆盖的字段留 null。我这边会合并。
6. 页面打不开 / 需登录 / 表格空 → `# UNAVAILABLE: <url> — 原因`，不要编数据填补。

## 需要覆盖的模型

**优先（目前完全没有运营数据，拿到才能进目录）：**
  GPT-5.6 Luna · Kimi K2.6 · Kimi K2.7 Code · Gemini 3 Flash · Grok 4.3（含 Beta）
  MiniMax-M3 · Inkling（含 Inkling-small）· Composer 2.5 · Qwen3.6-Plus · Qwen 3.6 Max
  Muse Spark（不带 1.1 的那个基础版）· Seed 2.1 Pro

**次要（已收录，用于核对现有数字是否过期）：**
  Claude Opus 5 · Claude Fable 5 · Claude Sonnet 5 · Claude Opus 4.8 · GPT-5.6 Sol
  GPT-5.6 Terra · GPT-5.5 · Kimi K3 · Grok 4.5 · GLM-5.2 · Muse Spark 1.1
  Gemini 3.5 Flash · Gemini 3.6 Flash · Gemini 3.1 Pro · DeepSeek V4 Pro
  DeepSeek V4 Flash · Qwen3.7 Max

⚠️ 这个名单是**覆盖目标**，不是输出清单。页面上没有的模型就不要输出那一行。
   绝对不要因为名单上有某个模型，就为它编一行数据。

## 要抄的页面

  https://artificialanalysis.ai/leaderboards/models      （主表：智能指数、每任务成本、tokens/s、延迟、上下文）
  https://artificialanalysis.ai/models                   （逐个模型详情页，主表展不开时用这个）
  https://lmarena.ai/leaderboard/text                    （text Elo）
  https://lmarena.ai/leaderboard/code/webdev             （code/webdev Elo）
  https://openrouter.ai/models                           （各家 input / output / cache 定价）
  以及各厂商自己的定价页（OpenAI / Anthropic / Google / xAI / Moonshot / Z.ai / DeepSeek / Alibaba / MiniMax）

## 输出格式

```jsonl 代码块，每行一个对象，字段固定（没有的填 null）：

{"model_raw":"GPT-5.6 Luna","effort":"max","maker":"OpenAI","open_weights":false,"context_k":1000,"intelligence_index":57,"cost_per_task_usd":0.9,"output_tokens_per_s":80,"latency_first_chunk_s":12.3,"price_input_per_m":2.5,"price_output_per_m":15,"price_cache_per_m":0.25,"text_elo":null,"code_elo":null,"evaluation_date":null,"source_label":"Artificial Analysis model leaderboard","source_url":"https://artificialanalysis.ai/leaderboards/models","source_kind":"independent","note":null}

- `open_weights`：true / false / null
- `context_k`：以 K 为单位的整数（1M 上下文写 1000）
- `intelligence_index`：Artificial Analysis Intelligence Index 的数值
- `cost_per_task_usd`：AA 的 Cost per Task（美元）
- 所有 price_* 字段：**每百万 token 的美元数**
- `evaluation_date`：页面标注的数据日期，ISO `YYYY-MM-DD`；没有填 null

JSONL 之后再输出：`# ROWCOUNT:` / `# COVERED:` / `# UNAVAILABLE:` / `# AMBIGUOUS:`

不要写总结、分析、排名点评或建议。只要数据。
````

### 拿到之后

存进 `data/sources/batch-06-operating.jsonl` + `.meta.json`。这一批**不走 `npm run ingest`**
（它产出的是模型记录不是观测行），会单独处理成 `MODELS` 里的 `configurations`。
凑齐参数后，12 个当前世代模型进目录，存档里等着的 43 行观测会自动接上。

---

## 批次 8 · 补齐运营参数（下一轮的主目标）

> `npm run check:models` 现在报 **171/255 有出处（67%）**，剩下 84 个值没有存档行支撑，
> 集中在两类：**老模型的速度/延迟**（44 个）和**没抓过的厂商定价页**（28 个）。
> 这一批把它们补完，能把 67% 推到 90% 以上。格式与批次 6 相同。

````
你是模型参数采集员。任务是**从公开页面逐行抄录模型的运营参数**，输出 JSONL。
这是抄录任务，不是估计任务。

## 硬性规则

1. **只抄，不猜。** 没有的字段填 null。绝不用同系列模型推算价格、速度或延迟。
2. **必须展开全部行**，或逐个打开模型详情页。抄完用
   `# ROWCOUNT: <url> — 可见 N 行，已抄录 M 行` 自查。
3. **effort 单独成行。** Artificial Analysis 把同一模型的不同 reasoning effort 列成多行，
   每个 effort 输出一行，不要只取最强的。页面没标 effort 就填 null。
4. **价格单位统一为「每百万 token 的美元数」。** 缓存价分清 cache **read/hit** 与
   cache **write**，我们要的是 read/hit，write 写进 note。没有就 null，不要用规则推算。
5. **区分上下文档位定价。** 若厂商按上下文长度分档（如 xAI 的 <200K / ≥200K、
   MiniMax 的 ≤512K / 512K–1M），**每档单独一行**，档位写进 note。
6. 一行一个来源。同一模型的 AA 数据与厂商定价来自不同页面，就输出两行，各带各的 URL。
7. 页面打不开 → `# UNAVAILABLE: <url> — 原因`，不要编数据填补。

## 这一批要补的两块

**A. 速度与延迟**（`output_tokens_per_s`、`latency_first_chunk_s`）
   到 Artificial Analysis **逐个模型详情页** 抓，主表没有这两列：
     Claude Opus 5（max/xhigh/high）· Claude Fable 5 · Claude Sonnet 5 · Claude Opus 4.8
     GPT-5.6 Sol（max/xhigh/high）· GPT-5.6 Terra（max/xhigh）· GPT-5.5
     Kimi K3 · Grok 4.5 · GLM-5.2 · Gemini 3.5 Flash · Gemini 3.6 Flash
     Gemini 3.1 Pro · DeepSeek V4 Pro · DeepSeek V4 Flash · Qwen3.7 Max
   入口：https://artificialanalysis.ai/models

**B. 厂商官方定价**（`price_input_per_m` / `price_output_per_m` / `price_cache_per_m`）
   批次 6 只跑到 OpenAI、Moonshot、MiniMax、xAI、Cursor。这次要这几家：
     https://www.anthropic.com/pricing            （Opus 5 / Fable 5 / Sonnet 5 / Opus 4.8）
     https://ai.google.dev/pricing                （Gemini 3.5 Flash / 3.6 Flash / 3.1 Pro）
     https://api-docs.deepseek.com/quick_start/pricing   （V4 Pro / V4 Flash）
     https://www.alibabacloud.com/help/en/model-studio/models   （Qwen3.7 Max / Qwen3.6 Plus / Max）
     https://docs.z.ai/guides/overview/pricing    （GLM-5.2）
     https://thinkingmachines.ai/                 （Inkling / Inkling Small，若有定价页）
     Meta 的 Muse Spark 1.1 定价页（若公开）

⚠️ 名单是**覆盖目标**，不是输出清单。页面上没有的模型不要输出那一行。

## 输出格式

```jsonl，字段与批次 6 完全一致（没有的填 null）：

{"model_raw":"Claude Opus 5","effort":"max","maker":"Anthropic","open_weights":false,"context_k":1000,"intelligence_index":null,"cost_per_task_usd":null,"output_tokens_per_s":54,"latency_first_chunk_s":83.49,"price_input_per_m":5,"price_output_per_m":25,"price_cache_per_m":0.5,"text_elo":null,"code_elo":null,"evaluation_date":null,"source_label":"Artificial Analysis model page","source_url":"https://artificialanalysis.ai/models/claude-opus-5","source_kind":"independent","note":null}

- `source_kind`："independent"（Artificial Analysis）/ "official"（厂商自己的定价页）
- 所有 price_* 都是**每百万 token 的美元数**

JSONL 之后输出：`# ROWCOUNT:` / `# COVERED:` / `# UNAVAILABLE:` / `# AMBIGUOUS:`

不要写总结、分析或建议。只要数据。
````

### 拿到之后

存进 `data/sources/batch-08-operating.jsonl` + `.meta.json`（`schema` 必须以
`Model operating parameters` 开头，否则会被当成观测行）。然后 `npm run check:models`
—— 它会直接告诉你补上了多少、还差哪些。**如果它报 catalog 与存档矛盾，以存档为准改目录。**
