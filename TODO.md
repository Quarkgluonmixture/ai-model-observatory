# TODO

**只放未来。做完的条目立刻删掉**——历史在 `LOG.md` 里，不在这。

结构性的「已知限制」不写在这里：那是 `docs/ARCHITECTURE.md` §10 的职责，那份是唯一真相。
这里只放**可以动手做完、做完就能删掉**的事。

---

## 继续把手抄批次变成脚本源

**30 个批次里 16 个可脚本重读**（2026-08-10 实测 `meta.collectedWith`，batch 30 = SWE-Bench Pro）。
按 §10 的规矩：**动手前先重新探一遍**，那份"没有路"的名单已经被推翻**九次**了（最近两次：
Vals、SWE-Bench Pro）。
⚠ **「还在裸奔 1,287 行」这个数复现不出来**：2026-08-10 用两种测法各得 1,404（自己写判定）和
1,226（用 `archive.mjs` 的 `supersededBy`），手抄总行也得 1,573 而不是 1,751。**先把定义钉死再引用它**，
别在它上面继续做减法。已确定的只有方向：batch 30 让 `batch-02-coding` 的 25 行 swe-pro 退出了这个池子。

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

- [ ] ⭐ **公安联网备案批下来后，页脚补第二个号**。2026-08-10 已提交至西城驻区大队，30 个自然日
      审核（约 2026-09-09 前出结果，短信发到备案预留手机号）。批了之后**只改一个常量**:
      `app/beian-filing.ts` 里的 `PUBLIC_SECURITY_FILING`(现在是 `null`)填上号码即可 ——
      页脚会自动多一条链到 `https://www.beian.gov.cn/`,而 `check:beian` 与 `check:deployment`
      **不用改一个字**就会开始断言它。这与 MIIT 的 ICP 备案是**两个不同的主管部门**，别混为一谈。
      ⚠ 2026-08-11 起这一格有回归网了(`check:beian` 在 CI 里硬失败),在那之前它只被手工验过一次。
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
- [ ] ~~**`qwen3.6-max` 只有 1 格（只有 gpqa）**~~ —— **2026-08-12 起是 5 格**(补上 HLE·no tools
      30.8 · SciCode 46.9 · AA-LCR 72 · IFBench 76.6),同一个 Max 档解析 bug 卡住的。
      它仍在地板 38 以下、仍带 `preview` 标签,**要不要留还是编辑判断,交给你** —— 变的只是
      「空行」这个理由已经不成立了。
      ⚠ 2026-08-13 补:这条现在挂在下面那节 preview 规矩上,别单独定。

## ⭐ 要你定:preview 记录的规矩(2026-08-13 挂起)

机制侧已经做完,并且**不依赖这个决定**(归属闸门第五条拒绝 · tags 派生 · 记录测量窗口,
见 `LOG.md` 2026-08-13)。剩下的是纯编辑判断,两个问题:

- [ ] **preview 该不该有自己的目录记录?** 目录里现在**两种先例并存**:`deepseek-v4-flash`
      走 Flash 解法(一条记录 = 在服役的那个,preview 留档案不入库),而 `qwen3.6-max` 是
      preview 自己占一条记录。定一次,以后就是规则。
      ⚠ **不能按显示名执行** —— 名字带 Preview 的还有 `gemini-3.1-pro`(**59 格**,全目录
      第二满),Google 把 Preview 当在售版本卖上几个月。判据是**上游有没有一个取代它的
      GA**,不是名字里有没有那个词;详见 `GOTCHAS.md` 25。
- [ ] **`deepseek-v4-pro` 的测量窗口什么时候解除、怎么解除。** 现在 `data/model-aliases.json`
      的 `modelWindows` 里挂着 `validUntil: 2026-08-12`,GA 分一律不落进这条 preview 记录
      (实测 ingest 逐字节不变,是纯守卫)。解除**不是代码改动**,就是上面那个决定:这条
      记录变成 GA 模型,还是 preview 留自己的记录、GA 另开一条。
      ⚠ 两个都得**等第一块板真发 GA 分**才能动 —— 第一个源决定串怎么拼(`GOTCHAS.md` 24)。
      ⚠ 它**只守会写 `evaluation_date` 的源**:这 10 个串下 73 行里有 38 行没有日期,那 38 行
      仍然放行。收窄靠给行补日期,不靠把比较写严(`scripts/lib/archive.mjs --self-test`
      把这个洞钉成了断言,改严会红)。

- [ ] **`vision` / `multimodal` 两个 tag 仍是手写。** 原理上可从上游 feed 的
      `architecture.input_modalities` 派生,但目录里没有任何字段存 modality,派生等于凭空
      发明事实 ⇒ 要做是一个 fetcher chunk(堆 2),不是改个名。

## ⭐ 价格链(2026-08-13 起,有硬期限)

- [ ] ⏰ **2026-08-16 DeepSeek 换峰谷计价,契约那天会自己红。** 已落档 batch 31 + `priceTerms`
      的 `scheduled` 形状,实测 8-15 exit 0 / 8-16 exit 1。那天要做的:按 `batch-31` 的
      `quotingRule` 用**峰时价**(list)重抓入档 → 改记录 → 退休该条款。
      ⚠⚠ **但先答上面 preview 那节的问题**:定价页只印裸串、不印 `-0813`,按 `GOTCHAS.md` 24
      判据 2 那两个价属于 **GA**,而目录那条是 preview。**先定记录身份,价格跟着身份走。**
      如果那天身份还没定,正确动作是**让它红着**,不是把 GA 的价填进 preview 记录。
- [ ] ⭐ **让 AA 当价格漂移探针(不是当权威)。** 已定:官方厂商页仍是报价权威(价格是售卖条款
      不是测量,而 AA 会把档位结构压成一个数);但现在 `priceRow` 优先官方源、而官方源是
      **手抄快照**,于是会动的 AA 行被忽略、涨价后契约照样全绿。
      要做的:AA 每日行与目录 list price 差超阈值 ⇒ 报"手抄的官方行可能过期了"。
      比给每个厂商写 fetcher 便宜得多,因为 AA 已覆盖所有厂商。阈值待定。
- [ ] **价格仍然进不了 ingest。** `ingest.mjs` 参数循环只收 Elo,价格全靠手打进
      `model-data.ts`、再由 `check-model-provenance` 事后审。要不要让价格也走 ingest 派生,
      是个独立决定(会动 51 条 stale slot 的处理方式,见 `GOTCHAS.md` 22)。
- [ ] 结构性、记着别当新发现：**`ArenaElo` 没有 harness 维度**，而 Sol 在 WebDev 板上唯一的行是
      `(codex-harness)`，所以站上那个 code Elo 是脚手架下的分。加维度会移动已发布数字。

## DeepSeek V4 Pro 转正（GA 2026-08-12，防线已建、数据还没来）

背景与判据全在 `GOTCHAS.md` 24，**别在这里复述**。这里只放要动手的：

- [ ] **等 GA 分第一次落进归档**。今天归档里 `0813` 零行（`grep -r 0813 data/sources/` 唯一命中是
      一个小数），`report:gaps` 已把 `deepseek/deepseek-v4-pro-0813` 列进「上游已发布、归档里什么都没有」
      那 5 个 —— 系统自己看见了，判定正确，**今天建记录等于画一整行空格**。
      第一批分到的那天照坑 24 的「动手顺序」走：先 alias 再目录，别先改显示名。
- [ ] ⭐ **要你定：厂商 GA 表要不要按转录入档，用什么当 `source_url`。**
      owner 2026-08-12 提供了 DeepSeek 官方发布图（四列：Pro-0813 / Flash-0731 / Pro-Preview /
      Flash-Preview，十行 agent 基准）。**图的真实性已交叉验证**：其中 Flash-0731 那一列的九项
      （Terminal 82.7 · NL2Repo 54.2 · Cybergym 76.7 · DeepSWE 54.4 · Toolathlon 70.3 ·
      ALE 25.2 · AutomationBench 25.1 · DSBench-FullStack 68.7 · DSBench-Hard 59.6）与官方
      changelog 2026-07-31 条目**逐位相同**，Pro-Preview 那一列的 HLE 37.7 与目录现有值也逐位相同。
      卡住的**只有 URL**：截至 2026-08-12 官方 changelog（中英两版）都还没有 0813 条目，
      HF 也还没有 `DeepSeek-V4-Pro-0813` 仓库 —— 也就是说这张表**先于官方文档渠道发布**。
      三个选项：(a) 等 changelog 上线，用 `capture-release-tables.mjs` 正规抓（可复跑，最干净）；
      (b) 现在按转录入档，`source_url` 指向 changelog 页并在 note 里写明「表来自官方发布图，
      条目当时未上线」；(c) 不入厂商表，只等第三方板。
      ⚠ 选 (b) 要想清楚：这个项目从来没有过 `source_url` 指不到那张表的行。

## 收录门槛：2026-08-12 已定「不放开」，剩下的是别的事

**地板不动这件事已经定了**，理由与四档实测（收 9 个 → 覆盖率 67.0% 掉到 53.5%、地板 48.2 塌到
38.6）在 `LOG.md` 2026-08-12 收尾条，**别在这里复述、也别重新论证**。这里只放派生出来的活：

- [ ] ⭐ **要你定：把「上游新出 N 个模型」那段从免责声明改成「最新发布」看板。**
      现在的文案连说两句自己不是什么（"不是缺陷清单，也不是待办"）然后折叠。同一份数据
      —— 9 个模型 + 发布日 + 还差多少格 —— 正着写就是访客最想看的那块。
      **覆盖率一个点都不掉**，它们本来就不在分母里。数据也现成（`app/api/live-models` 已经在算）。
      要做的是展示层：`app/models/page.tsx` 那段 + `app/upstream-variants.ts` 的判定不用动。
- [ ] **OpenAI 三个 Pro 档可能永远进不来，这与地板无关。** Sol Pro 7-09 发布至今 2 格，
      Luna Pro / Terra Pro 各 0 格。不是等得不够久：Pro 是**双模型系统**，第三方板基本不测
      （`model-aliases.json` 的 `_doc`「GPT 5.6 Sol (Max + Pro) - a two-model system」早写了）。
      要不要给这一类另一种处理方式，是独立判断题。**先放着**，等你想清楚 Pro 档在这个目录里算什么。
- [ ] 小：`qwen3.7-max` 摘掉假的 `open weights` 之后只剩两个 tag（别的记录都是三个）。
      补第三个是编辑判断，交给你；不补也不影响任何检查。

## 小口子

- [ ] 结构性、记着别当新发现：**`check:models` 尾部那节永远不会归零**。2026-08-12 把
      `intelligence` 与 `cost_per_task_usd` 整批改走 batch-14 之后,剩下的全是
      `speed` / `latency` —— AA 持续重测的活属性,双向抖动,追它不是目的。
      为什么这么切、方向统计如何,在 `LOG.md` 2026-08-12 和那两条 `supersededRows` 的 reason 里。

- [ ] ⭐ **要你定(小,但是站上看得见):`deepseek-v4-flash` 那一条 configuration 该叫什么。**
      2026-08-12 整批推 intelligence / costTask 之后,这个模型的两个值变成
      **有值但无据**(`check:models` 报告里那两行,不失败)。原因不是数据缺失:
      - 目录写的是 `cfg(null, 50, 0.03, …)` —— 一条**没有名字的** operating point。
      - AA 对这个模型发布**两个**:`non-reasoning` 29.3 和 `reasoning max` 51.8。
        目录那个 50 来自后者,只是从来没标出来。
      - 审计现在认「bare level 对上唯一一个 `<mode> <level>`」(见 `check-model-provenance.mjs`),
        但目录这条**连 level 都没写**,所以对不上任何一个。
      - 改法就一个字:`cfg(null, …)` → `cfg("max", …)`,值同时变成 51.8 / 0.0271。
        **没自己改,是因为 effort 标签是读者看得见的东西**,属于编辑判断不是数据判断。
      - 不改的代价:这两格永远停在「无据」那一节。不是错,但它是**唯一**两格。
- [ ] 观察一周：LMArena 每天都动，会不会天天产生自动提交。太吵就放宽取整阈值。
- [ ] ARC 的两条「显示名说该映射、`modelGroup` 说不是」的字符串
      （`openai-gpt-5-5-2026-04-23-high`、`google-gemini-3-1-pro-preview`）现在按两个带日期的快照
      处理、不映射。**如果 ARC 之后把旧快照撤下、只剩一条**，那就该映射了 —— 值得偶尔回头看一眼，
      代价是 ARC-AGI-3 的两格（0.43 / 0.42）。判据和证据写在 `data/model-aliases.json` 的 `_doc`。

## 自动化

- [ ] （原 8-08 的三件,2026-08-10 实测后只剩两件；③ 已确认:`auto/attribution` 8-08 开了 #58,
      判据没反）~~① `auto/refresh-aa` 到底有没有**自己**开出过 PR~~ —— **2026-08-11 观测证实**:
      `auto/refresh-aa` 自己开出了 **#74**,`gh: Argument list too long` 确实修好了。这条可删。
      ~~② 「Is the queue being worked?」那一节根本没建~~ —— **2026-08-11 证伪:建了,只是不在
      `report-gaps.mjs` 里**,而是 `upstream.yml:118-123` 直接 `node scripts/check-heartbeat.mjs
      --agent` 拼进 `gaps.md`(所以按 npm script 名 `check:heartbeat` 去 grep 会漏掉它)。这条可删。
      ⚠ 真正留下的那半个问题不在这:`--agent` **分不清 agent 和 owner**(两者都以人的身份提交),
      所以它答的是「队列有没有人在做」,不是「hermes 活着吗」——你自己开一次 session 就把三天时钟
      清零。见 `docs/ARCHITECTURE.md` §10 末尾「两个调度器互相看守是不对称的」那条。
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
