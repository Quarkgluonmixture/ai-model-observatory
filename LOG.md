# LOG

Append-only。发生了什么，以及**为什么**。做完的事从 `TODO.md` 删掉之后，它的理由留在这里。

标签固定五个，可多标：`#decision`（决定做/不做/回退）· `#measure`（测量结果，**必须带 n / 日期 /
怎么复现**）· `#deadend`（试过不行，连同排除它的证据）· `#incident`（踩坑/事故）· `#ship`（落地）。

**更早的条目已轮转到 `LOG-archive/LOG-2026-08.md`（19 条，至 2026-08-07 第五轮）。**
轮转不该让旧条目失联——检索一律两边一起搜：

```bash
grep -n '^## '     LOG.md LOG-archive/*.md   # 全量目录
grep -n '#deadend' LOG.md LOG-archive/*.md   # 试过什么不行
grep -n -A4 '#measure' LOG.md LOG-archive/*.md   # 所有数字连同出处
```

---

## [2026-08-07 第六轮] 把自动化的四个缺口做掉三个  #ship #measure #decision

接第五轮那份审计。用户拍板:1 做、2 不做、剩下自走。做完三个,每个都是**先造出失败再修**。

### 缺口 1:手机探针进 CI(已合 PR #54)

七项契约里 CI 跑六项,唯独需要浏览器那项留在本地 —— 于是它是**唯一一个靠人记性的检查**,而
`/models` 的表当天从 68 列涨到 72 列。ubuntu-latest 自带 `/usr/bin/google-chrome`,构建产物这个
job 本来就有,两条路由都探。

⭐ 关键决定:**找不到 Chrome 就让 job 失败,不跳过**。在 job summary 里 skip 和 pass 长得一样,
「探针没跑过」的绿灯比没有探针更糟。等 server 也加了上限,否则起不来的 server 会报成「超时」
而不是「server 没起来」。不引第三方 action,`command -v` 试四个可执行名。

### 缺口 4:空行保护(已合 PR #55)

**实测:一条零证据的目录记录,check:data / check:models / check:prices 三项全部 exit=0。**
72 列全 N/A 的一行在契约层面完全合法。到那天为止拦住它的,是「新增目录记录」恰好被计进
`describe-change` 的 `moved` —— **报告写法的副作用,不是谁设计的闸门**。

补成第四条条件:`new-models-below-floor`。地板是**算出来的**——加一个模型把网格拓宽整整一列,
所以只有带来的格数多于现有模型平均值时覆盖率才不降(今天 38)。新模型从平均值两边都排除,
否则一批薄记录能把自己要被衡量的线压下去。

⚠ 中途发现地板算错过一次:只解析生成文件得 36,真实看板是 38 —— 因为 `model-data.ts` 里还有
seed 观测。**偏小,而对地板来说偏小就是偏松**。改成从 `OBSERVATIONS_BY_CELL` 取。

⚠ 另一处:`unverifiable-cells` 的注释写着「Read by the charter's fourth merge condition」——
**没有任何东西读它,那个条件也不存在**。而针对它的闸门其实被实测否决过(70 列里 47 列单源)。
文档是对的,注释是错的。

### 缺口 3:线上站验证(PR #56,机制建好,差一个事实)

先试了两个想当然的做法,都不成立: #deadend
1. **静态 HTML 里找目录名** —— 只有 72 个里的 22 个,页面是客户端组件、目录默认折叠。
2. **headless 渲染后读 innerText** —— 6,345 字符,还差 49 个名字,它们在展开按钮后面。
   要驱动 UI 才行,而驱动 UI 的检查 UI 一动就坏。

成立的是**读 JS chunk**:数据被编进 bundle,跟 DOM 显不显示无关。9 个 chunk、1.5MB、名字全在。
两条失败路径都造出来验过(不重新构建就加 benchmark → 正确报缺失;`--strict` exit=1)。

⚠ **线上站地址在整个仓库里哪儿都没写** —— 不在配置、不在 workflow、不在文档。这个缺席本身
就是「没有东西验证部署」的一部分原因:**你没法检查一个你叫不出名字的部署**。留了
`data/deployment.json` 的 `productionUrl: null`,填之前每天在 gaps issue 里把自己报成「没跑」。

### 缺口 2:按用户决定跳过

hermes 死了没人被推送这条,用户说不用管。判据的不对称仍然在 §10 记着。

## [2026-08-07 第七轮] 新模型自动上板的机器人 —— 以及它跑出来的三个我的 bug  #ship #incident #decision

用户「机器人建」。建了 `scripts/propose-model.mjs` + `scripts/add-model-and-merge.sh`,接进每日 job。
**这一轮真正的产出不是机器人,是它逼出来的三个 bug —— 全部是「跑了才发现」。**

### 设计上唯一需要争论的一句

**「用哪条规则数格子,就用哪条规则写 alias。」** 记录没有 alias 就是空行、会被自己的第四条否决,
所以敢无人值守写记录就必须敢无人值守写 alias —— 而那正是 `propose-attribution` 对 maker 前缀串
拒绝做的事。解法不是两条规则,是**只有一条**:它映射的串,恰好就是当初把它算过地板的那些串。
数得宽、映得严会造出「靠证据进来、却接不上那些证据」的记录 —— 用算术算出来的空行。

推论:**计数规则从此是承重的**。而它错了两次。

### bug 1:前缀守卫挡数字不挡变体 #incident

第一次运行推荐加 `gpt-5.2`,要为它写 `GPT-5.2 Pro (High)`、`gpt-5.2-codex`、
`gpt-5.2-chat-latest-20260210` —— 全在 alias `_doc` 的「故意不映射」名单里,`gpt-5.2-codex`
还在归属闸门的陷阱集里。守卫只挡「剩余以数字开头」(治住了 `gpt-5` 吃 `gpt-5.5`),挡不住 `-pro`。

⚠ **也就是说地板本身一直在别的模型的证据上算**。换成项目自己那条规则(借来的,不是我发明的):
**剥掉 effort 之后不能有剩余**。`gpt-5.2` 从 ~40 格掉到 11 格。

### bug 2:漏抄了 report-gaps 一直有的 60 天窗口 #incident

`claude-sonnet-4.6` 也成了候选,带着 36 格真证据。它是上一代、目录故意不收。
**「不在目录里」悄悄变成了「目录不收的任何模型」。** 证据不是这种模型的问题所在。

### bug 3:只扫观测批次,漏了参数批次 #incident

压低地板逼出写入路径之后 `check:models` **exit=1**:写了 `Muse Spark 1.2 (xhigh)`,漏了
`muse-spark-1.2 (xHigh)`(在 batch-22,参数批次)—— 大小写近似串,精确匹配静默丢弃。
**归属闸门第一次上线栽的是同一个跟头**(`GPT 5.5 (high)` vs `GPT-5.5 (High)`)。

### 验收方式本身值得记

happy path 没有真候选可验(今天没有模型过得了 38 格地板),所以是**压低地板逼出来的**:
`--floor 5` 让 Muse Spark 1.2(7 格)过线 → 写入 → 三项契约全绿 → 第四条条件正确拦下 → 还原。
三个 bug 里有两个是这一步抓到的。∴ **无人值守的写入者,一定要能造出它的 happy path 来验。**

### 稳态

今天它什么都不做。Muse Spark 1.2 七格、地板 38。**这是设计不是坏了** —— 低于地板的是队列项。

## [2026-08-07 第八轮] 把「拒掉的」收进归档，以及三处元数据在撒谎  #decision #incident #ship

用户两个问题：「单一来源等也进数据库呢」「手抄为什么不能自动化」。两个都先纠正了我自己。

### 纠正一：「1749 行没有漂移检查」是虚高的

我说过两次这个数。逐行拆开：手抄批次里 1573 行观测，其中**真正在站上且无漂移检查的只有 216 行**
（184 已 supersede / 359 没 alias 没进库 / 814 故意不收的 benchmark）。我数的是文件总行数。

### 「手抄为什么不能自动化」—— 大部分已经自动化了

ARC、GPQA、DeepSWE、Terminal-Bench、ALE、GDPval、MMMU 全是先手抄后被脚本 supersede 的。
剩下 216 行：Vals 107 / batch-02 剩余 48 / OSWorld·MCP-Atlas 26 / Epoch 眼读 19 / Qwen 发布稿 12。
⚠ 最后那 12 行**根本不是手抄**（`capture-release-tables` 抓的），而厂商发布稿是时点快照、帖子不会变，
**没有漂移检查是正确行为不是缺口**。

### 「拒掉的收进来」—— 分两层，第一层早就是这么做的

归档里已有 1357 行「收了不入库」。真正没进归档的是 fetch 层拒掉的。收了 2225 行（AA 的 7 个字段），
配 `droppedBenchmarks` 条目逐条写理由，**站上零变动**。

⛔ **ARC 的 public split（363 行）明确不收**：它比同名 verified 板高约 11 分，收它换不来佐证
（测的是另一件事），却把一个高 11 分的数字放到离 `arc-agi-2` 列只差一个 alias bug 的地方。
**「我们没决定」和「我们决定不要」是两回事**，这条要写下来。

## [2026-08-07 第九轮] 问「源全不全」，最快的答案是项目自己有的字段  #measure #incident

每个批次 meta 都有 `filtered`，取子集的该有 `filterRule`。读成表 —— 三处不诚实：

1. ⚠ **`batch-22-arena` 声明 `filtered: false`，而它只取 ≥4 个板里的 2 个**。留下的两个
   （vision / hard-prompts）是因为 `ArenaElo` 只有两个字段、塞不进去 —— 但**「我们选择不要」
   和「这就是全部」是两个不同的断言**，批次做的是错的那个。
2. `batch-26` note 还写着「7 of the 17 keys」，当天早上已改成 14。
3. `batch-18`/`batch-20` 理由写在散文里、机器读不到。

现在 15 个 filtered 批次全部带 `filterRule`。顺带确认：Epoch 76 个 CSV 取 7 个、ARC 8 个 split 取 3 个、
AA 17 个字段取 14 个 —— 都有成文规则。

### 追这条线捞出的三件

① **站上最后一个手抄 Elo 清掉**：Inkling Small 的 1431 来自 LMArena 的 raw 板（style-control 板 385 行
确认没有它），而那个板已不在该路径暴露 —— 一列混两个板、且刷不了。改 N/A，与 Opus 4.8 code Elo 同判。

② ⭐ **机制空档**：`supersededRows` 在观测循环里被检查、**Elo 派生循环里根本不看它**。为这种情况
写的机制够不着这里。补成按字段检查（照 batch-08 的 `context_k` 先例）。

③ **记而不修**：`ArenaElo` 按 `model|effort` 键、**没有 harness 维度**，而 Sol 在 WebDev 板上唯一的
行是 `gpt-5.6-sol-xhigh (codex-harness)` —— 站上那个 1620 是「Codex 脚手架下的分」。
加维度会移动已发布数字，是决定不是修理。

### 顺带留了一个明早自跑的演示

ARC 当天验证了 DeepSeek V4 Flash 0731（AGI-1/-2 各 3 档）。**故意不写 alias** —— 归属闸门 tier 1
就认（靠目录显示名精确匹配），章程说不要替它做它那一半。明早那一跑就是端到端演示。

## 2026-08-08 — 溯源率 318/321 → 321/321（PR #59，自合）

### 背景

`check:models` 每次都报三个无源值：`qwen3.8-max open`、`qwen3.7-plus contextK`、
`qwen3.7-plus open`。值本身正确（与 AA 对比页一致），只是没有 archive 行支撑。

### 为什么之前补不上

AA 的**参数 API**（batch-14 读的）对这两个模型不发布 `open_weights` / `context_k`——
两字段在 API 里是 null。batch-21 从 QwenCloud 卡读 qwen3.8-max 时，那张卡对开源
状态不置可否，也留了 null。但 AA **渲染后的模型页**明确写着
"Context Window: 1M tokens" 和 "Proprietary — weights not publicly available"。
这跟 batch-08 当初给 qwen3.7-max 补 `context_k` 走的是同一个界面，只是当时没顺手
覆盖 Plus 和 Max。

### 做了什么

新建 `batch-27-aa-params-supplement.jsonl`（2 行，schema 标 "Model operating
parameters" → 进 operating-parameters 批次、被观测循环排除）：
- Qwen3.7 Plus：`open_weights:false, context_k:1000`
- Qwen3.8 Max：`open_weights:false`（context_k batch-21 已有）

只写了这两个字段，其余全 null——确保只补溯源、不动任何单元格或观测行。

### 自合判定（tier B 三条件）

1. 契约全绿（ingest 干净 → 0 观测行变化；lint / check:data / check:prices / build）。
2. `describe-change`：0 models, 0 moved，0 new models below floor。
3. 无 `acknowledgedDisagreements` / `mergedInOneSource` 豁免。

三条件满足，自合（177a5ea）。

### 顺手记下、没动

- qwen3.8-max `intelligence` 目录仍为 null，但 AA 现已发布 58。**故意没收**——更新已发布
  值是 AA-refresh 工作流的事，不是溯源修复。记进 TODO.md，下次 AA 刷新一并处理。
- qwen3.7-max 带着个误导性的 `"open weights"` 标签（tags 是 editorial、不被审计、
  `open:false` 本身正确），没动——留给 owner 定。

## 2026-08-09 — FrontierMath 变成脚本源（batch 28），顺带结掉「1.7x」那桩悬案

### 起因

排程 agent 的「AI 观测台日常班」当轮耗尽轮次而失败，报告里带着一条线索：Epoch 的排行榜
可能有机器可读的数据源，而且和文档里被排除的那个 zip 不是同一份。

### 查到的（都实测过，不是推断）

1. `epoch.ai/data/benchmarks.csv` 有 1311 条 run，按 `task` 列分组。FrontierMath 有**六个**
   task 家族，其中两个是站上现在渲染的：`FrontierMath-Tiers-1-3-v2-Private`（42 行）和
   `FrontierMath-Tier-4-v2-Private`（44 行）。
2. **「1.7x 分歧」的真正原因**：zip 里的 `frontiermath.csv` 正是
   `FrontierMath-2025-02-28-Private`——101 行、最高 52.40，和当初 epoch.mjs 头注释记的数字
   逐一对上；tier 4 那个是 `2025-07-01`（72 行）。**是两个题集，不是两次测量。**
   老注释说「分歧发生在 Epoch 的导出内部，原因不明」——数字全对，归因错了。
3. 页面确实读这个 CSV：`BenchmarkBody.*.js` → `benchmarks.*.js` → `fetch('/data/benchmarks.csv')`。
   而且榜单页自己的 astro island props 就把这块板叫 `FrontierMath-Tiers-1-3-v2-Private`，
   与 CSV 的 `task` 是同一个字符串。
4. **替换前先对账**：batch-01 手抄的 39 行里有 15 行的模型也在这份 CSV 里，15/15 在它当初四舍五入
   到的那一位上完全一致（87.7=87.72、85.3=85.26、80.0=80.00、62.8=62.81、14.6=14.63）。
   这才是允许 supersede 的依据。

⚠ 中途自己踩了一次：`grep -c "89.1" fm.html` 返回 5，据此以为分数是服务端渲染进 HTML 的。
`grep` 把 `.` 当通配符了，全是假阳性。用 Python 精确匹配复查后为 0。**数值 claim 要用精确匹配复核。**

### 做了什么

- 新 fetcher `scripts/fetchers/epoch-frontiermath.mjs` → `batch-28-frontiermath`，86 行。
  按 **task 名**而不是文件名选行——v3 来的时候会是新 task，不会是这两行被改写。
- `versioning: "append-only"`：v2 题集冻结（`task version` 全是 2.0.0、私有题集），但客人名单不冻结
  （Qwen3.8 Max 是 8-04 才被跑上去的）。跟 LiveBench 同一个理由。
- `tools_enabled` / `context_length` 这两个 CSV 不带的字段，从榜单页明写的 affordances 读
  （python + submit_answer 工具、1,000,000 token 硬上限）——和 livebench.mjs 取 scaffold 是同一种取法。
- 三道 fetch 期守卫，都会直接抛：task 名一行都匹配不上（改名了，写空批次等于删档案）、
  一个 configuration 出现两次（重跑了，哪条是发布值得人来定）、`mean_score ≠ best_score`
  （出了第二个 scorer）。
- supersede batch-01 的 `frontiermath`（39 行）；改掉 epoch.mjs 里那段归因错误的注释。

### 顺手修了一个静默失效的检查

`fetch-source.mjs` 的 `cellKey` 不含 `benchmark_version`。batch 28 是**第一个在一个批次里装两个
benchmark 版本**的批次（Tiers 1-3 和 Tier 4 共用 `benchmark: "frontiermath"`，靠 `benchmarkSplits`
在下游分开），于是两个 tier 撞进同一个 key——86 行只被核了 44 格，每个模型的 Tier 4 分数
**悄悄退出了自己的漂移检查**。加上版本字段后 86/86。其他源每批只有一个版本，key 只是变长。

### 结果

- 观测 1610 → 1635 行；cell 1094 → 1121（52.4% → 53.7%）。
- **新增 25 格**：GPT-5.6 Sol / Terra / Luna、Claude Opus 5、Claude Sonnet 5、Kimi K3、
  Qwen3.8 Max、Grok 4.5、Gemini 3.6 Flash、DeepSeek V4 Flash 0731 / V4 Pro 等两个 tier 各一格。
- **15 个已有数字变化**，全部是一位小数 → 全精度（最大 0.05）。所以 tier-B 三条件第 2 条不满足，
  **不能自合**——和 ARC 那轮同一个机制，闸门是对的，动的方向是纠正。
- 86 行里只有 44 行进目录。另外 42 行是目录不收的上一代（`gpt-5.4-pro-2026-03-05`、
  `claude-opus-4-7`、`o3-mini-2025-01-31` 等），外加 `gpt-5.6-sol_promax` —— 那是同一模型的
  operating point 变体，按「一个家族一条记录」不入目录，也不猜 alias。

### 留下的话

- 这 25 格**全部落在单源列上**。`frontiermath` / `frontiermath-t4` 本来就是四个核心单源列里的两个，
  batch 28 把它们填满了但没有把它们移出那份名单——同一个发布方读同一块板，仍然没有第二个声音。
- ARCHITECTURE §9 里「脚本源不等于正确源」那段没有退休，反而更锋利了：退休题集是**内部自洽、
  版本标注也正确**的，结构检查一条都不会响。

## 2026-08-09（第二轮）— 全自动化还差什么：补掉一个会吃掉一整天的洞

### 先把「差什么」量出来，别照抄文档

`docs/ARCHITECTURE.md` §10 自己记的三个数全部过期了，先实测重写：

| §10 原文 | 实测 2026-08-09 |
|---|---|
| 13 / 26 批次能自维护 | **14 / 28** |
| 12 个脚本批 3,381 行 · 13 个手抄批 1,749 行 = 65.9% | **8,716 / 1,751 = 83.3%** |
| 4 个目录值无源 | **0**（batch-27 于 8-08 补齐，321/321） |

⚠ 83.3% 这个数**不能当进步读**：手抄行从 1,749 只动到 1,751，比例上升全靠脚本批变大。
看绝对值，不看比例——所以那段话里加了一句 "Read the row count, not the ratio"。

### 补掉的洞：单源卡死会吃掉整天的漂移检查

**证据（同一台机器、同一条命令、同一份档案，一小时内）**：
- 一次跑**超过 80 分钟**没走到 MMMU，只能 kill；第二次约 9 分钟；第三次带时间戳跑，
  **全程 36 秒**（GDPval 14s、MMMU 15s，CI runner 上是 19s / 13s）。
- 三次之间归档没变、上游板没变。所以：浏览器 fetcher 卡住是**偶发、不可预测、无上界**的。

代价不是丢一个源，是丢**一整天**：drift job 有 `timeout-minutes: 10`，卡住时进程被杀在
打印任何东西之前——那天没有任何源被核对，而且那一步自己的 `could not be read` 报告也没跑成。
`fetch-source.mjs` 头注释写着「一个源失败不能拖垮其他源」，但这条保证**没覆盖「永不返回」**。

改法：
- `fetch-source.mjs` 加 per-source `FETCH_TIMEOUT_MS`（默认 300s = 实测健康值的 20 倍）。
  卡住 = 和抛错同一类事件：报出来、置 exit code、继续下一个源。
- 默认值故意宽松：笔记本上误报 `could not be read` 比慢一点更糟。**CI 自己设预算**
  （`upstream.yml` 两个跑 fetcher 的步骤都设 `FETCH_TIMEOUT_MS: 120000`），因为那边的
  job cap 才是让卡死变贵的东西。refresh job 那步尤其重要——它**会写**，被杀在中途会留下
  一半重写、一半没提交的批次。
- race 掉超时并不会真的停下卡住的工作（进了浏览器调用就没法停），所以这个文件末尾那句
  显式 `process.exit` 是承重的，不是习惯。

验证：`FETCH_TIMEOUT_MS=1` 走超时分支、node 退出码 1；正常路径 86 格照常核对；
全量 12 个源在新 key + 新超时下**全绿**，且逐源格数与当天 CI 的日志逐一对上
（897 / 53 / 619 / 17 / 57 / 179 / 71 / 496 / 201 / 200 / 26）——这就是「cellKey 那改动
没动到别的源」的实证。

### 查了但**没有**动的（都是有意的设计，不是漏掉的）

- **agent 死了没人推微信**。`upstream.yml` 里写明了理由：「没人在做的队列值得记下来，
  不值得打扰」。§10 也承认这是唯一没有推送兜底的失败。改它是在推翻 owner 8-06 那次
  10→4 的裁剪，属于判断不属于补洞——列进「要你定」。
- **单源列**（这次又多 25 格）、**LiveBench 新 release 的收集**、**目录记录落位**、
  **`ArenaElo` 没有 harness 维度**：文档里都写明是判断题，cron 不该做。
- **「新记录必须先有归档行」这条闸门**：§10 说「如果将来建了新模型自动化，缺的条件是…」——
  其实已经建了，`propose-model.mjs` 的准入比那句还严（要求高于看板平均格数），
  加上第四条 `new-models-below-floor`。那句话是旧的。

## 2026-08-09（第三轮）— Vals AI 变成脚本源（batch 29）：第八次推翻「没有路」

### 为什么两遍都没找到

§9 记的是「两遍都没找到机器可读路径」。两个原因叠在一起：

1. **`/benchmarks` 是索引页，不是榜单**——上面一个分数都没有，而两遍探的都是它。
   真正的板在 `/benchmarks/<slug>`，37 个。
2. **板本身没有「数据文件」**：Vals 用 Astro，Astro 把组件的 props 直接**服务端渲染进
   `props="…"` 属性**。整块榜单就在 HTML 里，以 HTML 转义的 JSON 形式存在。所以
   查 `<table>` / `<tr>` / `fetch(` / `/api/` 全部答「没有」——在一个装着整块板的页面上。
   JS chunk 里也找不到，因为数据从不单独传输。

CorpFin v2 那一页 1.16 MB，解出来是 131 模型 × 4 个 task 视图，每格带 accuracy / latency /
stderr / cost_per_test / harness / reasoning_effort / provider。手抄版本是 **6 行**，只有 accuracy。

⚠ 我自己第一次爬也失败了，两个 bug：Astro 的 import 是相对路径 `./`（我的正则只认 `/_astro/`），
以及 Vals 挡 `python-urllib`（curl 通）。**「爬不到」先怀疑自己的爬法。**

### 允许 supersede 的证据

`overall` 是榜单默认展示的那一栏：batch-05 手抄的 6 行 CorpFin
（73.19 / 71.83 / 71.56 / 71.29 / 68.57 / 68.53）与本文件的
73.194 / 71.834 / 71.562 / 71.29 / 68.57 / 68.532 **6/6 对上**。

另外三个视图（`exact_pages` / `max_fitting_context` / `shared_max_context`）**不是**同一个数的
另一种读法，是**三种不同的上下文条件**；LegalBench 的 `issue_tasks` 之类是子集。与 `overall`
并列会把一个模型的条件对上另一个模型的条件（第 4 条）。所以只读 `overall`，
外加 batch-05 当初刻意单列的两个子项（CyberBench poc/patch、Web Search finance/legal）。

alias 27 条，分两级、都写了理由：
- **23 条机械**：Vals 发的是 `provider/model`，去掉 provider 前缀后与目录 id **逐字相同**——
  就是归属闸门 tier 1 的规则，手工套用（因为没有重叠格可供 tier 2 印证）。
- **4 条靠数字印证**：`anthropic/claude-opus-4-8`（点写成杠）、`meta/muse_spark_1_1`（下划线）、
  `google/gemini-3.1-pro-preview`（带 provider 前缀）、`minimax/MiniMax-M3`（厂商自己的大小写）。
  每条都在共享的板上给出**同一个分数**才收。⚠ 我第一版把印证数字**编错了**（写了 91.0 / 69.12 /
  87.24），实测是 88.6 / 69.912 / 82.725 —— 理由里的数字必须实测后再写。

### 两个版本陷阱，都是 `check:data` 抓的、不是想出来的

1. **Vals 的 `version` 是「Vals 这块板的版次」，不是基准的版本**。它把自己的 GPQA Diamond 板叫
   `1`——那句话对 GPQA 是哪个 split 一无所知。写进共享列就成了 `v2.1` 和已有的 `2.1` 同格，
   check:data 直接报「一个格里混了两个版本」。
2. **但「一律填 null」也不免费**：`ingest` 会丢掉「既没有发布版本、又没有 `versionFallbacks`」
   的行。`terminal` 没有 fallback，于是一律 null **悄悄删掉了全部 50 行 Terminal-Bench**，
   而七项契约全绿——归档里有，看板上没有。现在共享列是一张**显式表**。
   ⭐ 教训：**null 不是中立值**；在有 fallback 的列上它是「继承」，在没有的列上它是「丢弃」。

### 一条 acknowledgedDisagreements

Qwen3.8 Max 在 Terminal-Bench 2.1 上有三个读数：Vals 67.416、AA 81.27（batch 26）、
Qwen 自家发布表 86.6（batch 17）。第 6 条：系统基准量的是 模型+脚手架+工具+预算，三家跑的不是
同一套。Vals 这块板逐行写 harness（别的模型上是 Claude Code / Codex / Cursor CLI），**这一行没写**；
Qwen 的表一个都没写，而且它最高——正是 §9 早就记下的「厂商在系统基准上偏高」的方向（那里记的是
+8 分，这里是比 Vals 高 19 分）。

### 结果

- 观测 1635 → 2086 行；cell 1121 → 1349（53.7% → **64.6%**）。
- **新增 227 格**，**51 个已有数字变化**。多数是精度（68.1 → 68.133），但有两个是**证据等级**变了：
  Qwen3.8 Max · Terminal-Bench 86.6（厂商）→ 67.416（独立），
  Gemini 3.1 Pro Preview · MMMU-Pro 80.5 → 88.208。**第 3 条在起作用**：独立读数压过厂商读数。
- 2,421 行里 953 行进目录，其余是目录不收的上一代（180 个未映射字符串）与 16 块没有列的板
  （全部归档 + 写明拒绝理由，将来开列不用重采）。
- ⚠ **189 格落在单源列上**——Vals 自己那 12 列按定义只有它一家。

### 自维护比例

15 / 29 批次可脚本重读；11,137 / 1,751 行 = 86.4%。但**别读这个比例**：1,751 行里有 464 行已被
supersede、不再供给任何东西，**真正还在裸奔的是 1,287 行**。而且排序变了——按「还在裸奔的行数」
排，第一名是 `batch-17-qwen3.8-release`（465，可发布帖是冻结的，没有漂移可查，所以它最大但最不值得做），
然后才是 batch-05 剩下的 LMArena 439 行。按文件大小排会指向 batch-05，而 batch-05 正是今天修掉的那个。

## 2026-08-09（第四轮）— 那「16 块没有列的板」其实不是一类东西

### 量完之后是三堆

用「这块板上有多少个**目录里的**模型」当尺子，而不是「有多少行」：

| 堆 | 板 | 结论 |
|---|---|---|
| **列已经存在，缺的只是接线** | `programbench`→`program`(22 模型)、`terminal-bench-2`→`terminal-20`(10) | 不是分类学判断，直接接 |
| **拒绝理由已过期** | `cyberbench` poc/patch | 原文「每个只有 2-3 行，不足以成列」——那是手抄时代的行数，实际各 18 个目录模型 |
| **明确不该开** | math500 0 · mgsm 0 · poker_agent 0 · medqa 1 · aime 2 | 开一列分母 +29 格、最多填 2 格 |
| **真判断（留给 owner）** | legal_bench 23 · tax_eval_v2 23 · emb 23 · hlab 22 · medcode 21 · sage 21 · time_horizon 7 · case_law 6 | 定轴 + core/observe |

### ProgramBench：差点顺手改错，被文档里一句话拦住

先做的是「同名不同物」检查 —— 这个项目栽过（ALE-Bench vs Agents' Last Exam 只共享三个字母）。
证据够硬：Vals 板的描述与 `facebookresearch/programbench` 的 GitHub 描述是**同一句话**
（"Can Language Models Rebuild Programs From Scratch?"）。

然后我给 `program` 加了 `versionFallbacks`，理由写的是「实测该列 0 行归档、没什么可混淆的」。
**这句话是错的**，而且错得很典型：我查的是**生成的 store**（0 行），不是**归档**。
归档里躺着 batch-02 的 **15 行**，来自 ProgramBench **自己的榜单**（`source_kind: benchmark`，
不是 §9 说的「厂商数字」），**全部因为没有版本而被 ingest 丢掉**。
⇒ 那条拒绝不是在保护这一列，是在**清空**它。加上 fallback 之后，这 15 行里有 7 行也一并回来了。

⚠ 但 §9 那句话里还有一半是对的，而且是**我差点踩的那一半**：
「ProgramBench 官方 Resolved score 给 GPT-5.5 是 0.5%，而某厂商表给同一格 70.8」。
真正防住它的**不是拒绝版本，是选对 task 视图**：Vals 发四个视图，
`partial`（Raw Pass Rate）给 GPT-5.5 正是 **70.775**，而 `overall` 与 `strict`（Fully Resolved）
**逐位相同**、是 **0.5** —— 与官方榜单的 0.5 一致。我读的是 `overall`，所以两个源同尺度。
归档里今天没有任何 raw pass rate 行；真来了，跨源分歧闸门会在那一格失败。

⭐ **两条教训，都是「查错了对象」**：
1. 「这一列是空的」要查**归档**，不是查生成产物 —— 生成产物是空的，可能正因为有东西被丢掉了。
2. **null 不是中立值**（第二次撞上，今天第一次是 terminal 50 行）：有 fallback 的列上它是「继承」，
   没有的列上它是「丢弃」。

### 结果

- cell 1349 → **1374（64.6% → 65.8%）**，`program` 从空列变成 29 行 / 23 模型
  （7 benchmark-native + 22 independent），`terminal-20` 从 11 行变 21 行。
- **没有任何已有数字被改动**；`unverifiable-cells: 0` —— 这两列现在各有两个来源，
  是这轮里唯一**降低**单源暴露的改动。
- cyberbench 的拒绝理由重写成实测状态：「行太少」那半条已死，「Vals 这块板逐行 harness 全是 null、
  而它的 SWE-bench / Terminal-Bench 板会写 Claude Code / Codex / Cursor CLI」那半条还站得住，
  所以它从「归档待议」升级成 TODO 里的**活决定**。

## [2026-08-09 17:52] Session 收尾：三轮脚本化上线 + 拆出 GOTCHAS.md  #ship #decision

- **#ship** 今天三个 PR 全部合进 main：#61（batch 28 FrontierMath）· #62（batch 29 Vals 全部 37 块板）· #63（ProgramBench 与 Terminal-Bench 2.0 接上已有的列）。覆盖率 **52.4% → 65.8%**（1094 → 1374 格），自维护批次 14/28 → 15/29。
- **#measure** 收尾时实测（n 见括号）：真正裸奔的手抄行 **1,287**（1,751 减去已 supersede 的 464）；`program` 列 0 → 29 行 / 23 模型；`terminal-20` 11 → 21 行；全量 12 源漂移检查健康值 **36 秒**（GDPval 14s、MMMU 15s）。
- **#decision** 新建 `GOTCHAS.md`（四件套的第五件）。触发条件两条都满足：快照被坑类条目顶过硬上限（151 行 vs ~120），且坑 1「null 不是中立值」**当天踩了两次**。快照里那些条目是**搬走**不是复制，快照只留按号指针。
- **#decision** 明确**不做**的两件，理由都写进了文件而不是只留在对话里：hermes 死了不补微信推送（维持 owner 8-06 那次 10→4 的裁剪，判据写进 TODO）；5 块目录模型 ≤2 个的 Vals 板不开列（理由写进 `droppedBenchmarks`，附实测数）。
- **下一步全是要 owner 定的**：CyberBench 两列开不开 · 8 块板的轴与 core/observe · `vals-mmlu-pro` 那一个断言 · `productionUrl`。见 `TODO.md`。

## [2026-08-10] ICP 备案页脚：挂在根 layout,不挂在页面  #ship #decision #measure

- **#ship** 备案下来了(`quarkspace.top`,京ICP备2026050077号-1),新增 `app/site-beian.tsx`
  + `app/site-beian.module.css`,由 `app/layout.tsx` 在 `{children}` **之后**渲染一次。
  两条路由实测各渲染一次(`grep -F` 精确匹配,不是 `grep` —— 见 `GOTCHAS.md` 坑 8):
  `/` 与 `/models` 的 **服务端 HTML** 里都有备案号 + `beian.miit.gov.cn` 链接 + `rel=noopener`。
  服务端渲染这点是要紧的:核验方不一定跑 JS。
- **#decision** 挂根 layout 而不是两个页面各写一份。理由不是省事,是**以后加的第三条路由**
  会漏——per-page 页脚的失败模式是静默的,而备案漏挂是监管问题不是显示问题。
- **#decision** 两个号不能混用:`京ICP备2026050077号` 是主体号,页脚要挂的是**服务号**
  (带 `-1`)。「挂主体号」那个说法是广东备案的情形,北京照抄会不合规。理由进 `docs/ARCHITECTURE.md` §6。
- **#decision** 页脚颜色**写死**,不引用任何一边的变量。因为它渲染在两套调色板之上,而 `.home`
  作用域里 globals.css 的 `--muted`/`--line` **仍然在 scope 内** —— 引用哪一套都会在另一个站上画错。
- **#measure** 手机契约两条路由都实测过(生产构建 + 真设备模拟,320/390/430):
  **无横向溢出**,无新增 <9px 文本(残留那条 `span > small @7.2px` 是评分表溯源标签,
  `docs/UI.md` §2 写明的例外,与本次无关),无触摸目标告警(链接手机上 `min-height:40px`)。
  ≤800px 的底栏避让走 `:global(.shell) ~ .strip`,产物里实测编译成
  `.shell~.site-beian-module__…__strip` —— `.shell` 是全局类所以选得中;`.home` 是 CSS module
  类名会被哈希,选不中(也不需要,个人站没有 fixed 元素)。
- **⚠ 只有 owner 能解的阻塞**:`quarkspace.top` 与 `www.quarkspace.top` **两个都不解析**
  (8.8.8.8 / 1.1.1.1 / 223.5.5.5 查 A 记录全空;域名 ACTIVE、NS 已指 DNSPod,缺的是记录本身)。
  腾讯要求主域名与 www **都能正常访问**才算合格,所以页脚做完了备案这件事**还没完**。
  `data/deployment.json` 的 `productionUrl` 因此继续留 `null` —— 指向一个不解析的域名
  只会让每日 job 因为与数据无关的理由变红。
- **补记(同日)**:公安联网备案已提交至**西城驻区大队**,30 个自然日审核(约 2026-09-09 前出结果,
  短信通知)。这与上面的 ICP 是**两个不同的主管部门**(MIIT vs 公安),批下来之后页脚要挂**第二个**
  号、链到 `www.beian.gov.cn`。因为页脚是根 layout 的单一组件,那会是**一个文件的改动** ——
  这正是当初不做 per-page 页脚换来的东西。备案预留手机号**不入库**(公开仓库不放个人号码)。
- **同日下午:域名绑定完成,站上线在 `quarkspace.top`**。
  **#measure** 三个 host 全部 200 + TLS 验证通过(`43.174.24x.110`);备案号在
  `quarkspace.top` × `www` × `/` × `/models` 的**服务端 HTML** 里 **2×2 全绿**(逐格实测,
  不是抽一格)。EdgeOne 默认域名 `ai-model-observatory-lhi0hg2y.edgeone.cool` 同一份构建。
  **#decision** `productionUrl` 填 apex 而不是 www:两个都绑了、都独立 200、互不跳转,所以这是
  **选一个**而不是发现一个;不选会让每日检查在没人引用的 host 上通过。⇒ `check:deployment`
  **从此真的在跑**(此前从未跑过一次),首跑绿:线上服务的目录名与 `main` 一致(29 × 72,9 chunk)。
  **⭐ 教训(顺序)**:EdgeOne 绑域名是**三步**且顺序要紧 —— 先 `edgeonereclaim.<domain>` 的 TXT
  证归属,**之后**才发 per-host CNAME 目标。**归属权验证不服务任何一个字节**:过了验证域名依然
  可以完全不解析(当天上午就是这个状态,而我一度把"文档里写着不解析"当成了当前事实)。
  **⭐ 边界**:`check:deployment` 比的是 `main` vs 线上(抓半截部署),**它不看备案号显示没显示** ——
  所以那个 2×2 是手工实测的,没有假装被自动化覆盖。

## [2026-08-10] gaps 报告分三层:真队列 / 无证据 / 定价档  #ship #decision #incident

- **起因**:owner 说那份「上游已在提供、目录还没有的模型」清单「看着非常膈应,按理说该全自动化」。
  查下来结论**和直觉相反** —— 自动化早就有(`add-model-and-merge.sh` 四道闸门,每日在跑),
  今天的判定是「不该收」,提议器原话 `Nothing qualifies. That is the expected steady state`。
  病灶在**呈现**:一份 never-fails 的清单把三类东西混排,读起来像 8 件待办,实际 2 件排队 +
  6 件永远不该收。
- **⭐ 走错一次路,值得记**:我先改了 `report-gaps.mjs`,跑完发现那一节今天只有 2 行、
  `tiers=0` —— 那 8 行**根本不是这个报告出的**。真正的出处是 `aa-new-models.mjs`
  (输出带「发布」二字)。`report-gaps` 的 `catalogNeedles` 过滤器早就把 `(batch)` 挡掉了
  (id 含 `claude-opus-5`),AA 侧没有这道。⇒ **动手前先确认那段文字是谁打印的**,
  同一件事在这个仓库有多个检测器,症状一样、代码不同。
- **#ship 两处都做了分层**(渲染契约:非工作项一律**段落内联反引号**,不用 `- \`id\`` 列表行 ——
  `publish-gaps-issue.sh` 靠那个 bullet 形状认「今天新出现的模型」,既有 `images` 组就是这么做的)。
  `report-gaps` 还补了「**还差 N 格**到地板」,并按接近地板排序(原来按发布日期,新≠该收)。
  地板差值用 `floor + 1 - cells`(过地板要**严格大于**平均),muse-spark-1.2 = 差 18 不是 17。
- **#decision 档位判据是合取**:关键词闭合清单 **且** 归档 0 行。带证据的 `(batch)` 留在队列里
  给人看 —— 贵的错是静默丢掉真模型,不是多印一行。`preview` **故意不在**清单里:目录里
  `Gemini 3.1 Pro Preview` / `Qwen3.6 Max Preview` 各自成记录(preview 是不同权重,batch 是
  同权重不同价)。分类器加了 `--self-test`,14/14 过 —— 因为它是这次改动**唯一的风险面**
  (太贪就会让真模型不再被报告),而这个脚本要 API key 才能整体跑,自测是本地唯一的验证手段。
- **#ship 不只是观感**:档位被计进 `<!-- aa-new-models: N -->` 会**触发一次没意义的 AA 重抓**
  (591 个配置读回来学不到东西)。现在从计数和触发里都排除了。
- **#incident 顺带撞出一件旧账(不是本次引入)**:`upstream-evidence.mjs --self-test` 实测
  **70% recovery / 1 个幻影格**(`deepseek-v4-flash` 的 `ifbench`),而注释里写着 89% / 0。
  那个模型正是「一个字符串两个模型」那个案例,最可能是 `norm` 混了两种拼法。**要紧**是因为
  这个计数器决定谁过地板、而自动上板按它合并。注释已改成带日期的实测值(**没有**把注释改成
  好看的数字了事),真修记进 `TODO.md`。⚠ 两个 `--self-test` 都不在 CI ⇒ 漂了没人知道。
- **补:两个自测挂进 CI,并纠正我自己上一条记录**。owner 选了「先修计数器再挂 CI」,而查下去
  发现**没有计数器要修** —— `upstream-evidence.mjs` 顶部**本来就写着**这个 over-count 存在且刻意保留。
  我上一条把它记成「漂移 / `norm` 混了拼法 / 需要修」是**错的**,已在原处改正(注释、TODO 都改)。
- **⭐ 实测把因果翻过来了**:`batch-26-aa-evaluations` 里裸 slug `deepseek-v4-flash` 带**两套完整分数**
  (gpqa 71.6 与 90.8 · hle 7.8 与 38.6 · aa-lcr 37.33 与 74.33),**所有行 `effort` 都是 null** ——
  批次里没有任何字段能分开两者。所以它在该批次故意不映射(第 8 条),计数器按字符串照样匹配上。
  ⇒ 真修是**拿 AA 用来区分那两个条目的字段重抓这个批次**,不在计数器里。记进 TODO,
  **没有猜 alias**(AGENTS 里 49.25 挂在 100 分模型名下那段教训就是这个形状)。
- **#ship 自测从「打印」变成「闸门」**:未钉住的 over-count → 失败(按**格**钉,不按模型,
  钉住的模型再长一格算新发现);mean recovery < 60% → 失败(下限是回归护栏不是目标,今天 70%,
  当初写的 89% 随归档变大和 effort 守卫收紧而下降,属预期)。钉住的豁免**不再出现**只报告不失败 ——
  归档每天在动,让「已知问题消失」把 CI 弄红是错的激励。
- **#measure 失败路径实证过**(照这个仓库给 `add-model-and-merge.sh` 做过的那样):探针把豁免清空 +
  下限抬到 99 → **exit 1** 且两条 FAIL 都打印;正常路径 exit 0,那格标 `ifbench (pinned)`。
  没验过失败路径的闸门不算闸门。

## [2026-08-10] 纠正:batch-26 没有问题,是我读错了字段名  #incident #decision

- **撤回上一条的结论。** 我说 `batch-26-aa-evaluations` 里那两套分数「没有任何字段能分开、必须重抓」
  —— **错的**。字段叫 **`reasoning_effort`**,我用 `r.get('effort')` 取值(那个键不存在),
  于是每行都返回 None,据此下了结论,还照这个结论改写了 `upstream-evidence.mjs` 顶部**原本正确**
  的注释,并开了一条「要你定:怎么重抓」的 TODO。注释已恢复成准确版本(并留了一句
  「不要再推导出那个结论」),TODO 已删。
- **实测的真实情况**(四个 AA 条目,每个都有自己的 `reasoning_effort`、AA 显示名、独立 source_url):
  `reasoning max` = `DeepSeek V4 Flash 0731 (Reasoning, Max Effort)`,发布 2026-07-31 = 目录记录;
  另外三个(`non-reasoning` 与两个 `-0420`)全是发布 **2026-04-24** 的四月版。
- **⭐ 而且 alias 早就写好了**:`{modelRaw: deepseek-v4-flash, effort: "reasoning max",
  file: batch-26-aa-evaluations, modelId: deepseek-v4-flash}`,那 6 格(gpqa 90.8 · hle 38.6 ·
  scicode 49.9 · aa-lcr 74.33 · tau3-banking 39.38 · terminal 78.65)**都已在库中**(逐格实测)。
  它的 reason 里甚至写着「Found by the evidence counter's self-test」—— 正是这次争论的那个机制。
  ⇒ **这件事早就被正确处理过了**,我等于把一个已解决的问题重新发明成了一个未解决的问题。
- **⭐⭐ 教训(比这次改动重要)**:**JSON 字段名要对着一行真实数据核,不要凭语义猜**。
  `.get('effort')` vs `reasoning_effort` —— Python 的 `.get` 对不存在的键**静默返回 None**,
  于是「字段缺失」和「值为空」长得一模一样,而我把前者读成了后者。这跟坑 1「null 不是中立值」
  是同一族:**缺席被当成了一个值**。下次:下「某字段全为空」的结论前,先 `print` 一整行原始 JSON。
- **保留的部分仍然有效**:#68 的钉住豁免 + CI 闸门与这个理由无关,照样成立(它挡的是**新**的
  over-count)。只有解释文字是错的,已改。

## [2026-08-10] batch 30:SWE-Bench Pro 从手抄变成脚本源(第九次推翻「没有路」) #ship #measure #decision

- **#ship 机制**:`labs.scale.com` 是 Next.js App Router,所以对榜单 URL 发一个带 `RSC: 1` 头的
  普通 GET,返回的 flight 流里**整块看板是内联未转义 JSON**(`"entries":[{model,rank,score,
  confidenceInterval_upper,company,createdAt,maxScore,deprecated}]`),不需要浏览器。
  没有 JSON 端点 —— 旧结论说的是这件事,它没错;错的是**只探了端点就收工**。
- **⭐⭐ 那个星号是 harness,不是装饰**。页面自己两句话都在载荷里:
  「We ran frontier models on Pro using the **SWE-Agent** scaffold」(默认)+
  「\*Run with **mini-swe-agent** harness」(带星的行)。实测 5 星 / 20 无星,**与 batch-02 手抄的
  5/20 逐行一致** —— 当年那位转录者读对了。⇒ fetcher 每次抓取都**断言这两句在**,不在就 throw;
  读错星号 = 把两个脚手架并进一个格子,违反第 4 条,而且看起来跟真结果一模一样。
- **#decision 不硬编码任何板级常量**。harness 两句 + `731 instances` 全部是断言而非假设;
  `deprecated: true` 的行跳过(Scale 另有一个 deprecated 板);`tools_enabled` 留 null
  (板子是 agentic 的,但它**没有**发布工具清单,写 true 就是替它断言)。
- **#measure 失败路径逐条验过**(六条):缺默认 harness 句 / 缺星号脚注 / 缺 731 / 没有 entries /
  entries 空数组 / HTTP 403 —— **全部 throw**,没有一条会静默返回小一号的看板。这很要紧:
  静默空读会长得像「Scale 删掉了所有模型」,然后漂移检查会把它报成归档完整性失败。
  括号配平也用「名字里带 `] [`」的行走真实解析路径验过(正则 `[^\]]*` 会在那里断掉)。
- **#measure supersede 安全**:脚本串与手抄串**逐字相同**(`Muse Spark 1.1*`、`gpt-5.4 (xHigh)*`),
  所以同一批 alias 继续命中。`describe-change` 实测:**「这次改动不改变任何已发布的数字」**
  (0 moved / 0 unverifiable),3 行 swe-pro 观测原地换出处;重读自检报
  「archive matches upstream, **25 cells verified**」—— 写 25 行核 25 格,对得上(GOTCHAS 坑 3)。
- **⚠ 顺带发现一个复现不出来的数**:文档里的「还在裸奔 1,287 行 / 手抄 1,751 行」两种测法都对不上
  (1,404 vs 1,226;手抄总行 1,573)。**我没有用第三个数去覆盖它**,而是在 TODO 里标注「先钉定义
  再引用」。教训与今天早些时候那次同形:**别重写项目自己的判定逻辑**,要么用它的 resolver,
  要么把定义找出来 —— 我第一版又手搓了一遍 supersede 匹配,和 resolver 差了 178 行。

## [2026-08-10] 假阴性:一条子串过滤让 gaps 报告对 Flash Lite 全盲  #incident #ship #measure

- **起因**:owner 追问那份上游清单。八行里七行如预期,**第八行 `Gemini 3.5 Flash Lite` 一个字都没出现**。
- **根因**:`report-gaps.mjs` 用 `item.id.includes(catalogId)` 判断「目录已有」。
  `google/gemini-3.5-flash-lite` **包含** `gemini-3.5-flash`(目录 id)⇒ 被判成已收录。
  ⚠ **这是假阴性,比噪音危险**:噪音你看得见,漏报你看不见。
- **⭐⭐ 同一个坑这个仓库已经付过一次代价**:`AGENTS.md` 里记着 `list.find(id => id.includes("gpt-5.6"))`
  返回 `openai/gpt-5.6-luna-pro`、Sol 价格卡渲染成 $0.10/$0.60,所以 `PROVIDER_LOOKUPS` 改成了精确
  匹配 —— **另一个文件里没改**。而且刺眼的是:这次冒出来的正是 `gpt-5.6-luna-pro` 那三个 `-pro`。
  ⇒ 教训:**修一个类型的 bug 时,把同一类型的所有调用点一起找出来**,别只修报出来的那一处。
- **#ship 修法是共用规则而不是再写一份**:把 `matches` 从 `buildEvidenceIndex` 的闭包里提出来,
  导出成 `sameFamily(published, family)`(内部自己 norm,调用方无法忘记),`report-gaps` 直接用。
  这个模块存在的理由本来就是「两个调用方要同一个数字,第二份副本会漂移」—— 过滤器是第三个调用方,
  之前它自己发明了一个更差的规则。
- **#measure 效果**:60 天窗口内上游可见条目 **2 → 7**(4 有证据 / 2 无证据 / 1 定价档)。
  `gemini-3.5-flash-lite` **42 行证据、33 格**,是全场证据最好的候选(比 Muse Spark 1.2 的 31 格还多),
  差 16 格到地板 —— 排序改成「按接近地板」之后它直接排第一。
  副作用是好的:`claude-opus-5-fast` 现在落进「定价档」组 ⇒ 我昨天说「档位分类器在 report-gaps
  里几乎是死代码」**不再成立** —— 它之前是被子串过滤**因为错误的理由**藏起来的。
- **⭐ 自测当场教了我一件事**:给 `sameFamily` 钉 15 条用例时,
  `"DeepSeek V4 Flash 0731 (Reasoning, Max Effort)"` 断言失败 —— 因为 `norm` 剥
  `[\s._\-()]` **但不剥逗号**,`reasoning,maxeffort` 里那个逗号挡住了 effort 剥离。
  **是我的期望写错了,不是代码错**;而 `norm` 不能改(文件写明必须与归属闸门的归一化一致)。
  已把该用例期望改成 `false` 并写下原因 —— 这也是 recovery 只有 70% 的一个来源:**AA 的操作点带逗号**。
  失败路径验过(把 Flash Lite 那条期望翻成 true → exit 1)。

## [2026-08-10] 收尾:上游那一节折叠 + 只计过地板的 + 四条 gotcha 编号  #ship #decision

- **#decision owner 说「那些应该不是缺陷吧」—— 对,而且是我让它读起来像缺陷的。**
  `report:gaps` 设计上 never fails,它头上就写着「a missing model is not a defect in the commit
  under review」;但我上一版把**整个队列**都计进 `gapCount`,而那个数决定 GitHub issue 开不开。
  ⇒ 现在**只有过了地板的候选才计数**:地板下的谁也加不了(要等源去评测),把它计进去等于
  拿不存在的活把 issue 钉在 open,读者两天就学会跳过整份报告。
- **#ship 整节折叠**(`<details>`,GitHub issue 正文里可渲染),摘要一行带四个分组的数,并明写
  **「Nothing in this section is a defect」**。⚠ `</details>` 关在「本侧缺陷」之前 ——
  死掉的价格 lookup、没有 lookup 的目录模型**留在外面并继续计数**,因为那两样今天就能修。
  实测 `publish-gaps-issue.sh` 的 `- \`id\`` 解析在折叠内仍然认得出 4 个模型(它不在乎嵌套)。
  计数从 60 → 58。
- **#ship 文档**:`ARCHITECTURE.md` §8 的 CI 清单**本来就是不全的**(缺 backtest 与手机探针),
  一并补齐成十项,并写明后四项各自是"因为某个无人值守的判断被信任而非被测试"才加的;
  §8 另加一段讲清「印出来的」与「计入的」不是一回事。`AGENTS.md` 补两个自测的用途与
  「钉住的 over-count 不算失败、新的算」。README 的 maintains-itself 表补一句。
  `CHECKPOINT.md` 刷新接手点/归档行(30 批次 16 脚本化)/CI 行/16 个源,并**退役**了 8-09 那三条
  过期观察项(batch 29 的 51 个数字、「明早三个第一次」——都已在 LOG),换成明早真正该看的两件。
- **⭐⭐ `GOTCHAS.md` 新增第五族「我以为我知道数据长什么样」(坑 15–18)**。拆出来的理由是
  **同一天踩了三次同形错**:`.get('effort')` 静默 None(15)· 手搓 supersede 判定差 178 行(16)·
  子串过滤造成假阴性(17)。第 18 条是写自测时当场被教育的 `norm` 不剥逗号、且**不能改**。
  三次的代价都不是"跑不通",是**写下一个自信的假结论并据此改了文档** —— 这才是要防的。

## [2026-08-10b] 网站上那份「上游模型」从没拿到过滤器 —— 而噪音在遮三个真模型  #fix #decision #gotcha

- **起因**:owner 说「为啥网站上还是这个…这个你不是折叠了吗」。我上一轮折叠的是
  `report:gaps` 打的那份 GitHub issue。**同一句话有两条代码路径**:
  `scripts/report-gaps.mjs`(AA 存档证据链)与 `app/api/live-models/route.ts`(OpenRouter 运行时)。
  `tierOf` / `variantOf` 我在前者写过、在 `aa-new-models.mjs` 又写了一遍,
  **读者唯一看得到的那一条从来没有**。issue 干净 ≠ 网站干净 → **GOTCHAS 19**。
- **⚠ 代价不止难看(这条是这轮最重要的发现)**:route 的 `.slice(0, 8)` 是**最后一道**,
  那 5 条 `(batch)` / `(Fast)` 正占着 8 个名额里的 5 个 ⇒ `GPT-5.6 Luna Pro` / `Terra Pro` /
  `Sol Pro` **三个真模型、目录里都没有、全被挤出列表**,一个字都看不到。
  实测(真 feed):过滤前 8 条(5 噪音 3 真)→ 过滤后 **6 条,全是真模型**。
  **静默截断读起来就是「就这些了」** ⇒ route 现在同时返回 `freshTotal`,页面在被截时明说
  「下面只列出最近 N 个」。
- **#decision 不写第三份判定逻辑**(GOTCHAS 16 的直接应用):新建
  `app/upstream-variants.ts` 作为**唯一的家**,route 与两个脚本都 import,两份旧拷贝删掉。
  ⚠ route 里必须写 **`.ts` 扩展名** —— `report-gaps.mjs` 是用 Node 直接跑 `route.ts` 的,
  app→app 的 import 没有打包器替它猜(`allowImportingTsExtensions` 本来就开着)。
  `aa-new-models.mjs --self-test` 现在跑的就是共享模块,14/14 仍过 ⇒ CI 那道闸自动覆盖了新家。
- **#decision 两个调用方严格程度不同,是故意的**:脚本能读存档,所以要求
  「关键词 **且** 存档为空」——一条 `(Fast)` 若真有证据,会留在队列里而不是消失进档位行;
  route 在 edge 上没有存档,只有关键词一条。不对称只可能让**网站的折叠少显示一个名字**,
  `report:gaps` 仍会报 ⇒ 失败方向是安全的。已写进模块注释。
- **#ship 网站侧折叠**:`<details>`,摘要一行给数,展开第一句直说
  **「这不是缺陷清单,也不是待办」**+ 收录的真实门槛(存档里有观测行)+ 档位已排除。
- **#gotcha 顺带两个(→ GOTCHAS 20)**:`<small>` 继承 80% ⇒ 9px 块里是 **7.2px**,
  `check:mobile` 立刻报;折叠起来看不见**不等于**可以低于地板(点开就读得到),所以改字号、
  不加豁免。更值得记的是:`check-mobile.mjs` 的控件选择器原本 **没有 `summary`** ——
  我加的第一个折叠控件它量不到,而**检查器不选中的东西永远通过**。补进选择器后,
  用「把高度压到 10px 看它报不报」**证明**了探测在跑(`details.fresh-note > summary h=13`),
  不是加了行就当生效。
- 实测收尾:tsc 0、lint 0、`check:data` 2133 观测 / 1382 格 / 66.2%、provenance 321/321、
  `ingest` 无 diff、prod build + `check:mobile` 三个宽度全过、`report:gaps` 仍是 58。
  发布的数字一个没动(这轮完全没碰 `data/`)。
- 另:`tsconfig.tsbuildinfo` 是 `tsc --noEmit --incremental` 的缓存,进 `.gitignore`,不提交。
