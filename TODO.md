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

- [ ] ⭐ **要你定:AA 把 Qwen 的 Max 档放在 `effort` 里,目录把它当族名 —— 这一格自动修不了。**
      原条目写的是「下次 AA 刷新时一并更新」,**2026-08-11 证伪**:那次刷新(PR #74)如期发生,
      没更新,而且机制上永远不会。逐条实测:
      - AA 参数 API 把旗舰拼成**裸词干 + effort 单列**:`qwen3-8`/`max`、`qwen3-7`/`max`、
        `qwen3-6`/`max`、`qwen3`/`max`。四条 `resolveModelId(...)` **全部 undefined**
        (Plus 档不受影响:`qwen3-7-plus` 有自己的 slug,解析正常)。
      - `check-model-provenance.mjs:71` 对解析不到的行**直接跳过** ⇒ 这四行连被检查的资格都没有,
        所以「321/321 backed · 0 contradictions」为真,但它的**范围是解析得到的行**。
      - ⚠ **光加别名不管用**:同文件 `:219` 按 `模型id|effort` 分桶,`qwen3.8-max` 的
        configuration effort 是 `null`,只会去 `|null` 桶取值;effort 为 `max` 的行落进 `|max` 桶,
        对那一格依然不可见。而 `max` 在 `claude-opus-5_max` / `gpt-5.6-sol_max` 上是**真 effort**,
        「统一把 max 并进族名」会错到别家头上。
      - 代价(2026-08-11 实测,归档值取 PR #74 刷新后):

        | 目录 | 现在写着 | AA 参数 API 这一行 |
        |---|---|---|
        | `qwen3.8-max` | intel/cost/speed/latency **全 null**(全目录唯一一个) | 58.1 / 1.132 / 81.57 / 2.81 |
        | `qwen3.7-max` | 46 · **1.28** · 199.6 · 2.45 | 46.7 · **0.5413** · 201.87 · 2.31 |
        | `qwen3.6-max` | 40 · null · 45.9 · 3.29 | 41.1 · null · 50.21 · 3.5 |

        `qwen3.7-max` 那行**有据**——来自 `batch-07-aa-leaderboard` 与 `batch-08-operating`,
        都是 AA 的**旧读数**,所以契约全绿。但 AA 现在这一行的 cost **差 2.4 倍**,
        而漂移闸门看不见它 ⇒ 站上挂着过期的旗舰成本,不会有任何检查报出来。
        这是「报告干净 ≠ 网站干净」发生在**参数**上,不是观测格上。
      - **两个都站得住的选项**(要你选一个,机械件我来):
        (a) **fetcher 层归一**:对着一份闭合的「厂商产品档」清单(Alibaba 的 max/plus,不是 effort)
            把档位并回 `model_raw`、effort 置空。好处是目录语义不动;代价是要维护第二份闭合清单。
        (b) **目录层认账**:把这三条记录的 configuration effort 从 `null` 改成 `max`。
            好处是不写新规则;代价是给一个没有 effort 维度的族**造出**一个维度。
      - ⚠ 无论选哪个,合并那一刻 `qwen3.7-max` 的 cost 会从 1.28 动到 0.5413 ——
        **这是已发布数字的移动**,正好撞三条件第二条,按章程就不该无人值守地做。
      - 顺带:`data/model-aliases.json` 里 `Qwen3.8 Max` 那条的 reason 写着「AA 的评测板比参数 API
        先收录这个模型,所以目录有 GDPval 分而没有 intelligence」——**那句话现在过期了**,
        参数 API 已经有它,只是拼法解析不到。定案时一并改掉,别让下一个人再查一遍。
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
