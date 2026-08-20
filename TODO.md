# TODO

**只放未来。做完的条目立刻删掉**——历史在 `LOG.md` 里，不在这。

结构性的「已知限制」不写在这里：那是 `docs/ARCHITECTURE.md` §10 的职责，那份是唯一真相。
这里只放**可以动手做完、做完就能删掉**的事。

---

## 继续把手抄批次变成脚本源

**可脚本重读的批次数不在这里维护**——`CHECKPOINT.md` 的「归档」那一行有实测值和复算命令
（这里原本抄了一份「30 个批次里 16 个」，2026-08-10 的数，到 8-17 已经错了两处）。
按 §10 的规矩：**动手前先重新探一遍**，那份"没有路"的名单被推翻的次数见 `GOTCHAS.md` 36
（最近一次：DeepSeek 把 GA 发布表发成 PNG，同一张表在 HF model card 上是 markdown）。
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

## ⭐ 要你定:ProgramBench 这一列的口径(2026-08-15 又撞到一次)

目录同一列上现在有三个读数:官方榜 **0**、Vals **0.5**、厂商发布表 **63.7**(Kimi K3 表带进来的)。
差六十多分,是两把不同的尺子。GLM-5.2 那次采集**故意没映射**这一列,理由写进了
`droppedBenchmarks` —— 但那只是不再加第三个厂商读数,没有解决已经在里面的那两把尺子。
要定的是:这一列量的是什么,官方那把还是厂商那把;定不了就该考虑把它移出 core。

## ⭐ 要你定:通知侧的两件(2026-08-14,报警器静默失灵之后)

机制侧已修(#79:SIGPIPE + `--self-test` 进 CI,见 `GOTCHAS.md` 29)。
2026-08-17 又修了一件**不在这两条里**的:`main 变红` 那条改成按**红的集合变化**推
(`scripts/notify-main-red.mjs`,坑 **38**)——那天同一个红推了 8 次。下面两条**仍然没定**:

- [ ] **`upstream.yml` 要不要停止把通知失败吞成绿色。** 那两句 `|| echo "::warning::"` /
      `|| true` 是 07:03 那次"步骤显示绿色"的直接原因。改它等于说"通知发不出去该让 job 变红",
      而 `notify-pushplus.mjs` 头部写着相反的理由(通道没配不该让 job 变红)——同一问题的两面。
      折中方案:区分"通道没配"(跳过,绿)与"脚本自己崩了"(红)。
- [ ] **integrity 与 availability 要不要拆成两条通道。** 现在 `upstream.yml:82` 用一句
      `grep -q "no longer matches its archive"` 定性,**分不出「值被改写」和「值新增」** ——
      §10 的表格早把这两件事定成不同 verdict。8-14 那次 availability 失败因此走了 integrity 通道
      (幸好被 #79 修的那个 bug 挡住,没发错名字)。要定的是:读不出源该不该也推手机。

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
- [ ] **「fetcher 收行 → 闸门归属 → 自合」端到端仍然没看到过一次。**
      ⚠ 2026-08-20 更新:`deepseek-v4-flash` 的三格 ARC-AGI-2 确实上板了(arcprize 8-14 benchmark 行
      + Epoch 8-20 independent 行,两源各一行),但它们走的是 `model-aliases.json` 里**已有的**
      `-0731` 裸串条目 —— **归属闸门那天没有提出任何新 alias**。所以这个观察点是**没有发生**,
      不是发生了并通过;别把「行上板了」读成「闸门跑通了」。下一个真活例还得等。
- [ ] ⭐ **要你定:`qwen3.6-max` 这条 5 格的记录留不留。** 2026-08-19 实测 **5 格**
      (aa-lcr · gpqa · hle-no-tools · ifbench · scicode),显示名 "Qwen3.6 Max Preview",
      tag `["preview","multilingual"]`。**「空行」这个理由早就不成立了**(它曾经只有 1 格,
      是同一个 Max 档解析 bug 卡的,2026-08-12 修完补到 5 格)。
      ⚠ **别拿稀释地板量它**:地板(今天 48)是给**新增一条记录**用的尺子,对已在目录里的记录不适用
      —— 见 `GOTCHAS.md` **40**,这个仓库刚为同一个误用卡了三天。要定的是纯编辑判断:
      5 格的记录值不值得占看板一行。
      ⚠ 名字**不用动**:上游精确同名、族里没有取代它的 GA ⇒ 按坑 25 它不是待转正的 preview
      (与上面 preview 那节同一个判据)。

## preview 记录的规矩:2026-08-14 已定,`deepseek-v4-pro` 2026-08-19 已翻转

**规则已定**(理由与实测在 `LOG.md` 2026-08-14 条,**别重新论证**):**一条记录 = 一个在服役的版本**,
Flash 的解法。preview 的行留在归档里不入库,不是删掉。名字优先抄厂商发布过的那个。

**`deepseek-v4-pro` 已按这条规则翻转成 GA(2026-08-19)**,四步动作与代价都做完了:38 格 / 66.1%,
价格 $1.32/$3.96,batch-31 的 term 已退休。做法与踩到的坑在 `LOG.md` 2026-08-19 与
`GOTCHAS.md` **42/43/44** —— **别在这里复述**。

**Qwen 与 Gemini 两条查过、不动**:`Qwen3.6 Max Preview`(5 格)和 `Gemini 3.1 Pro Preview`(59 格)
上游都是**精确同名**,且各自族里**没有取代它们的 GA** ⇒ 按 `GOTCHAS.md` 25 的判据它们不是待转正的
preview,名字是对的。

翻转留下的两件(都不急,都是编辑判断):

- [ ] **`deepseek-v4-pro` 的 `open` 现在无据**(`check:models` 那节唯一的第三条,报告不失败)。
      原来的据是 batch-06/08 里 preview 的 `open_weights: true`,已随裸串一起拒收。GA 有自己的
      HF 仓库(`deepseek-ai/DeepSeek-V4-Pro-0813`,batch-35 的 `sources` 记着),但归档里**没有一行
      断言它的许可**。补法 = 采一行,不是手打一个 tag(这个仓库为手打 tag 付过一次代价)。
- [ ] **`value` 这个 tag 还算不算数**:价格从 $0.435/$0.87 涨到 $1.32/$3.96(3 倍),
      而 `costTask` 现在是 null ⇒ 它已经**不在 value lens 里**,但 chip 还挂着。留还是摘是编辑判断。

## 价格 term 红着还挡住谁(2026-08-19 只解了一半)

refresh job 那一半**已定并已改**(降成只报,`ci.yml` 仍硬红,理由与实测在 `LOG.md` 2026-08-19)。
剩下的是**另外两个仍然硬闸**的调用点,值得单独定,别顺手改:

- [ ] `scripts/attribute-and-merge.sh:48` —— 归属闸门只写 `data/model-aliases.json`,
      **改不了 `check:prices` 的判定**(同样是零写者),所以它也是一条假依赖。
      ⭐ 但它挡住的是**自动写别名**,风险面比 refresh 大,单独定。
- [ ] `scripts/add-model-and-merge.sh:68` —— **这一条该留着硬闸**:它写 `app/model-data.ts`,
      而那正是 `check:prices` 的输入之一(新记录的 id 撞上一条 term 的 `modelId` 就会开始被比较)
      ⇒ 它**真的**能改变判定。记在这里是为了别把三个调用点当成同一件事一刀切。

## ⭐ 要你定:红着的时候 CI 只跑前 9 步,要不要重排(2026-08-17)

第一个红之后所有步骤 skip,而 `check:prices` 排在很前面 ⇒ **pro 红着的这段时间,24 步里只有 9 步
真的在跑**:build、`check:beian`、手机探针、归属回测、五个 self-test 全部没跑过(从 8-16 起)。

- 已经处理的只有一条:守「main 变红」那个报警的 self-test 挂了 `if: always()`,因为它要守的正是
  job 失败时才触发的东西(坑 **39**)。
- 要定的是**其余的怎么办**:把不依赖数据契约的步骤(lint 之后那批 self-test、build)挪到
  `check:prices` 前面,或者也挂 `always()`,或者维持现状(红了就整条停,也是一种一致的语义)。
  ⚠ 改步骤顺序会改变 CI 的语义,是一件独立的活,别顺手做。

## 价格链(峰谷计价两半都已落地,剩下的是结构性的)

- [ ] **价格仍然进不了 ingest。** `ingest.mjs` 参数循环只收 Elo,价格全靠手打进
      `model-data.ts`、再由 `check-model-provenance` 事后审。要不要让价格也走 ingest 派生,
      是个独立决定(会动 51 条 stale slot 的处理方式,见 `GOTCHAS.md` 22)。
- [ ] 结构性、记着别当新发现：**`ArenaElo` 没有 harness 维度**，而 Sol 在 WebDev 板上唯一的行是
      `(codex-harness)`，所以站上那个 code Elo 是脚手架下的分。加维度会移动已发布数字。

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
- [ ] 结构性、记着别当新发现:**`report:gaps`「Worth collecting」的 mrcr / charxiv / imo-answer /
      hle-tools 四条,2026-08-18 逐源审计对各自点名的模型已穷尽**。供给源全是冻结物且未过滤
      (batch 17 整表 465 行、batch 32 整表 123 行,均 `filtered: false`;imo-answer 的另一源
      IMO-Bench 论文 Table 4 是 2025 年的 13 个旧模型)—— 等待的 2026 模型不在任何一张表里,
      scripted 源里也没有 mrcr / charxiv 的活板。那些格子只能等**新源发布**,不是「重读」能补的;
      issue 里那句 "re-reading it may add models" 对这四条不成立,别照着它再去翻一遍冻结帖。

## 自动化

- [ ] **`check-heartbeat.mjs --agent` 分不清 agent 和 owner**(两者都以人的身份提交),所以它答的是
      「队列有没有人在做」,不是「hermes 活着吗」—— **你自己开一次 session 就把三天时钟清零**。
      见 `docs/ARCHITECTURE.md` §10 末尾「两个调度器互相看守是不对称的」那条。
      ⚠ 它不在 `report-gaps.mjs` 里,是 `upstream.yml` 直接拼进 `gaps.md` 的,所以按 npm script 名
      `check:heartbeat` 去 grep 会漏掉它。
      ⚠ 判据是 branch-scoped：`pr-hands-off.sh` 查 `gh pr list --head auto/attribution`，
      **只看那一个分支**，别的分支上有没有 open PR 它一概不管。
- [ ] **重复发布的折叠现在只在 Epoch 一个 fetcher 里**(2026-08-20,坑 **47**)。
      要定的是**要不要提到共用层**:任何一个源哪天开始把同一条测量发两遍,症状还是同一个 ——
      duplicate-configuration 断言红 ⇒ **整批**(不只是那个源)扣住入档,而看板看着完全正常。
      ⚠ 不建议顺手做:折叠放共用层等于给所有 fetcher 默认开一个"悄悄扔行"的行为,
      而这个仓库的默认是**留证据**。折中方向 = 共用层只**检测并大声报**,折叠仍留给各 fetcher 自己声明。
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
