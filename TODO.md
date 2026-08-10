# TODO

**只放未来。做完的条目立刻删掉**——历史在 `LOG.md` 里，不在这。

结构性的「已知限制」不写在这里：那是 `docs/ARCHITECTURE.md` §10 的职责，那份是唯一真相。
这里只放**可以动手做完、做完就能删掉**的事。

---

## 继续把手抄批次变成脚本源

29 个批次里 15 个可脚本重读。**真正还在裸奔的是 1,287 行**（1,751 行手抄里有 464 行已被
supersede、不再供给任何东西）——别拿 86.4% 这个比例当进度。
按 §10 的规矩：**动手前先重新探一遍**，那份"没有路"的名单已经被推翻七次了。

⚠ batch 28 之后多一条判据：**探到数据文件不算完，还得确认它就是页面渲染的那一份**。
Epoch 的 zip 确实发布 FrontierMath，读进来的却是退役题集（见 `LOG.md` 2026-08-09）。

候选（按对覆盖率的价值排）：

- [ ] OSWorld 2.0 / Toolathlon / MCP-Atlas（agent 轴，目前全靠手抄）
- [ ] FrontierSWE / ProgramBench（后者官方分与厂商表差 70 分，注意别混指标）
- [ ] APEX-Agents

ARC Prize 三个 split（batch 23/24/25）已全部脚本化并接上目录，见 `LOG.md` 2026-08-07 第四轮。
探测细节住在 `scripts/fetchers/arcprize.mjs` 的头注释里，不在这。

## 自动化剩下的缺口（2026-08-07 第六轮后，详情在 `docs/ARCHITECTURE.md` §10）

三个做掉了（手机探针进 CI · 空行第四条 · 线上站验证机制——**2026-08-10 起真的在跑了**，
`productionUrl` 已填 `https://quarkspace.top`），缺口 2 按你的决定跳过。剩下：

- [ ] ⭐⭐ **要你定：`batch-26-aa-evaluations` 里的裸 `deepseek-v4-flash` 怎么办**（2026-08-10 查实）。
      那个批次里**同一个裸 slug 带着两套完整分数**——gpqa 71.6 与 90.8、hle-no-tools 7.8 与 38.6、
      aa-lcr 37.33 与 74.33——而**所有行的 `effort` 都是 `null`**，批次里没有任何字段能把两者分开。
      所以它在这个批次故意不映射（第 8 条：绝不猜归属），13 行就这么躺着。
      **不是计数器的 bug**：`upstream-evidence.mjs` 顶部本来就写着这个 over-count 存在且是刻意的；
      我上一轮把它写成「`norm` 混了拼法、需要修计数器」是错的，已改正。现在它在自测里是一条
      **带理由的钉住豁免**，新出现的 over-count 会让 CI 红。
      **真修只有一条路**：拿 AA 用来区分它那两个条目的字段重抓一次这个批次（AA 侧大概是
      reasoning / non-reasoning，但**这要看到实际字段再说，不能推**）。抓到之后这 13 行才能归属。
      ⚠ 别用「猜一个 alias」了事——AGENTS 里 DeepSeek V4 Flash 那段教训就是这个形状（49.25 挂在
      100 分的模型名下，而且什么都没失败）。
- [ ] ⭐ **要你定：`swe-pro` 的 Scale 活板要不要写成 fetcher**（2026-08-10 排程 agent 查出来的）。
      它走 Next.js RSC flight —— 带 `RSC: 1` 头 GET 就能拿到 `"entries":[{model,rank,score,…}]`，
      不需要浏览器。现在 `batch-02` 是手抄且冻结，**Scale 哪天评测了新模型没人会发现**。
      两边的理由都实打实：写了以后 Grok 4.3 / Kimi K2.6 上榜会自动进 PR；但 RSC flight 是
      React 内部序列化、**不是稳定 API**，Scale 升级 Next.js 可能**静默坏掉** —— 而静默失效
      恰好是这个项目最怕的那类。⇒ 若要做，`versioning` 该怎么声明、以及 supersede `batch-02`
      的 `swe-pro` 行，值得单独一轮，不是顺手活。（当天重读实测：活板只有 25 行、全是上一代，
      **零增量**，所以这是纯基础设施投资，今天不换任何一个格子。）
- [ ] ⭐ **公安联网备案批下来后，页脚补第二个号**。2026-08-10 已提交至西城驻区大队，30 个自然日
      审核（约 2026-09-09 前出结果，短信发到备案预留手机号）。批了之后在 `app/site-beian.tsx`
      里加一条链到 `https://www.beian.gov.cn/` 的公安备案号——**一个文件的事，不要加到页面上**。
      这与 MIIT 的 ICP 备案是**两个不同的主管部门**，别混为一谈。
- [ ] ⭐ **要你定：hermes 死了要不要推微信**。GitHub 挂 → hermes 推微信；hermes 挂 →
      只写进它自己读的那个 issue。**这是唯一没有推送兜底的失败**（§10 自己也这么说）。
      没动是因为 `upstream.yml` 里写明了相反的理由——「没人在做的队列值得记下来，不值得打扰」——
      改它等于推翻你 8-06 那次 10→4 的裁剪。要补的话建议做成**告警而非状态**：
      队列非空 + 连续 N 天没有人类提交，才推一条。
- [ ] **单源列上的格子又多了 25 个**（batch 28 的 FrontierMath 两列；原本 91 格，τ³-Banking 和
      IFBench 按定义只有 AA 一家）。跨源分歧闸门在那些列上永远不会响 —— 结构性的，不是能修的，
      记在这里是防止有人误以为闸门覆盖了它们。
- [ ] **观察新模型闸门第一次真正触发是什么时候**（`auto/new-model` 分支）。今天它什么都不做——
      Muse Spark 1.2 七格、地板 38——那是稳态。第一次触发时**逐条看它写的 alias**：它的匹配规则
      是承重的，建的时候就错过两次（前缀吃变体、漏 60 天窗口），两次都是跑出来才发现的。
- [ ] **明早看归属闸门接 DeepSeek V4 Flash 0731**。ARC 2026-08-07 验证了它（AGI-1/-2 各 3 档），
      行已在归档、alias 故意没写——闸门 tier 1 认得出。这是「fetcher 收行 → 闸门归属 → 自合」
      端到端跑通的第一个活例子，值得看一眼它到底自合了还是留了 PR。
- [ ] **`qwen3.6-max` 只有 1 格（只有 gpqa），看板上已经躺着一条空行**。新地板 38 挡得住未来的，
      没回头清理过去的。它带 `preview` 标签，可能是有意留的——要不要留是编辑判断，交给你。
- [ ] 结构性、记着别当新发现：**`ArenaElo` 没有 harness 维度**，而 Sol 在 WebDev 板上唯一的行是
      `(codex-harness)`，所以站上那个 code Elo 是脚手架下的分。加维度会移动已发布数字。

## 小口子

- [ ] qwen3.8-max `intelligence` 仍为 null，但 AA 现已发布 58 —— 属于 AA-refresh 工作流，
      非溯源修复。下次 AA 刷新时一并更新。
- [ ] 观察一周：LMArena 每天都动，会不会天天产生自动提交。太吵就放宽取整阈值。
- [ ] ARC 的两条「显示名说该映射、`modelGroup` 说不是」的字符串
      （`openai-gpt-5-5-2026-04-23-high`、`google-gemini-3-1-pro-preview`）现在按两个带日期的快照
      处理、不映射。**如果 ARC 之后把旧快照撤下、只剩一条**，那就该映射了 —— 值得偶尔回头看一眼，
      代价是 ARC-AGI-3 的两格（0.43 / 0.42）。判据和证据写在 `data/model-aliases.json` 的 `_doc`。

## 自动化

- [ ] 明早（2026-08-08）验三件事：① `auto/refresh-aa` 的 PR **自己开出来**（8-07 是
      `gh: Argument list too long` 开不出来）；② gaps issue 末尾多一节「Is the queue being worked?」；
      ③ `auto/attribution` **正常跑**——#45 已于 8-07 合并，没有 open PR 了，所以 `--any-open` 不该
      触发。要是它反而写了「Attribution paused」的 warning，就是那个判据反了。
      ⚠ 判据是 branch-scoped：`pr-hands-off.sh` 查 `gh pr list --head auto/attribution`，
      **只看那一个分支**，别的分支上有没有 open PR 它一概不管。
- [ ] 观察 `--any-open` 第一次真正生效是什么时候（下一个被三条件拦在 `auto/attribution` 上的 PR）。
      那天起**新 alias 提议会开始积压**，确认 warning 确实写进了 step summary、不是静默的。

## batch 28 之后留下的两件（2026-08-09）

- [ ] **`gpt-5.6-sol_promax` 这个 operating point 要不要收**。Epoch 的 Tier 4 板上它是 80.49，
      比 `gpt-5.6-sol_max` 的 82.93 低一档。现在按「一个家族一条记录、effort 在观测行上」不映射，
      所以它被跳过并上报。要收的话得先想清楚 `promax` 在 `configurations` 里叫什么——
      这是编辑判断，不是 alias 判断。
- [ ] **v3 来的时候要做什么**：`epoch-frontiermath` 的 `latestVersion()` 会自己报
      「Epoch 已发布 v3，档案里是 v2」并给出重采命令。**重采是目录决定**，因为 v2 和 v3
      不能进同一列（架构第 4 条）——要新开 benchmark 版本，跟 Terminal-Bench 2.0/2.1 一样。

## 自动化：量过之后，真正剩下的（2026-08-09 第二轮）

补掉的不用列（见 `LOG.md`）。**剩下的按能不能自动分堆**（堆号是稳定标识，不重排）：

**堆 1 · 只差你一个事实** —— 2026-08-10 已清空（唯一一条是 `productionUrl`，域名上线后填了）。

**堆 2 · 能自动，但是下一个 chunk（要写新 fetcher，不是补机制）**
- [ ] **还剩 1,287 行裸奔**。按「还在裸奔的行数」重排（不是按文件大小）：
      `batch-17-qwen3.8-release`（465）· `batch-05-independent`（439，只剩 LMArena 与合成指数）·
      `batch-02-coding`（136）。⚠ 第一名**不值得先做**：发布帖是冻结的，没有漂移可查。
      真正值得的是 `batch-02-coding` 里那 136 行（SWE-Marathon / PostTrainBench / FrontierSWE），
      以及 batch-05 的 LMArena（已有 batch-22 脚本源，需确认剩下 439 行里哪些是它没覆盖的）。

**堆 3 · 判断题，cron 不该做（记在这里防止有人当成待办来"修"）**
- 单源列（batch 28 又加了 25 格）· LiveBench 新 release 的收集 · 目录记录落位 ·
  `ArenaElo` 没有 harness 维度 · 活价与目录价的 10 处分歧。

## batch 29 之后留下的（2026-08-09）

- [ ] ⭐ **要你定：CyberBench 的 poc / patch 两列开不开**。原拒绝理由「每个只有 2-3 行」是手抄时代
      的行数，实测各 **18 个目录模型**，那半条已经死了。还站得住的是另一半：CyberBench 是 agentic
      板（「自主 agent 能不能造出触发 OSS-Fuzz 漏洞的 PoC、并写出修复补丁」），而 **Vals 在这块板上
      逐行 harness 全是 null** —— 它的 SWE-bench / Terminal-Bench 板会写 Claude Code / Codex /
      Cursor CLI。第 6 条：系统结果 = 模型 + 脚手架，脚手架不明是真代价。
      要定的是：**进哪根轴（agent 还是 coding），以及 core 还是 observe**。
- [ ] ⭐ **要你定：8 块真正需要新列的板**（行已全部归档，开列不用重采）。按目录模型数排：
      `vals-legal_bench` 23 · `vals-tax_eval_v2` 23 · `vals-emb` 23 · `vals-hlab` 22 ·
      `vals-medcode` 21 · `vals-sage` 21 · `vals-time_horizon_index` 7 · `vals-case_law_v2` 6。
      每列要定**轴 + core/observe**（core 会动 portfolio 地板，分母也确定要涨 —— 全开的话覆盖率
      会从 65.8% 往下走，即使绝对格数 +155）。机械件（`versionFallbacks`、中英名、url）我来。
      ⚠ 这些板 Vals 只标 `1`，本项目不记这种版次 ⇒ **没有 fallback 的列上 null = 丢行**，不是默认值。
- [ ] **`vals-mmlu-pro` 23 个目录模型卡在一个断言上**：`mmlu-pro` 列声明 version 2025，Vals 不发版本。
      加 fallback 等于**替 Vals 断言它跑的是 2025 release，而没有人这么说过**。这一格判断交给你。
- [ ] 明确**不开**（已写进 `droppedBenchmarks` 并附实测数）：math500 0 · mgsm 0 · poker_agent 0 ·
      medqa 1 · aime 2 个目录模型 —— 开一列分母 +29 格、最多填 2 格。
- [ ] **180 个 Vals 字符串没有 alias**（多数是上一代）。归属闸门对它们会说
      「no like-for-like cell shared with any family」——因为 Vals 是这些模型唯一的源。
      要收就得人工判断，不急。
- [ ] ⚠ **单源格又多了 189 个**（Vals 自己那 12 列按定义只有它一家）。
