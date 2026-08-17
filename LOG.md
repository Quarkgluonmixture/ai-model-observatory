# LOG

Append-only。发生了什么，以及**为什么**。做完的事从 `TODO.md` 删掉之后，它的理由留在这里。

标签固定五个，可多标：`#decision`（决定做/不做/回退）· `#measure`（测量结果，**必须带 n / 日期 /
怎么复现**）· `#deadend`（试过不行，连同排除它的证据）· `#incident`（踩坑/事故）· `#ship`（落地）。

**更早的条目已轮转到 `LOG-archive/LOG-2026-08.md`（41 条，至 2026-08-12 — Qwen 的 Max 是**产品档**不是 effort;顺手挖出「先到先得」占坑）。**
轮转不该让旧条目失联——检索一律两边一起搜：

```bash
grep -n '^## '     LOG.md LOG-archive/*.md   # 全量目录
grep -n '#deadend' LOG.md LOG-archive/*.md   # 试过什么不行
grep -n -A4 '#measure' LOG.md LOG-archive/*.md   # 所有数字连同出处
```

---

## 2026-08-12(第二轮)— 整批推 intelligence + costTask;路上发现 batch-14 的 effort 从来没读全 `#decision` `#ship` `#measure` `#incident`

**裁决**:owner 说「做」。范围 = `intelligence_index` 与 `cost_per_task_usd` 整体改走 batch-14,
`speed` / `latency` 不动。

**⚠ 先自我修正上一条**:上一轮我把「`glm-5.2` intelligence 34 → 52.6」当成最大的一条标度漂移
报给了 owner。**那是错的。** 它是 effort 落错桶 —— batch-14 把 `GLM-5.2 (max)` 的 52.6
记成 effort 空,而目录的 default 档正好读那个桶。修好之后这一条从名单上消失。
⇒ 教训:**一个异常值大得不像同类,先怀疑它不是同类**(进 `GOTCHAS.md` 22 的补注)。

**由此挖出的真问题** `#incident`
`scripts/fetchers/artificial-analysis.mjs` **只读 slug**,不读显示名。AA 有 **135 个模型**
把操作点只写在名字里(slug `glm-5-2` / 名字 `GLM-5.2 (max)`)⇒ 这 135 行 effort 全空,
而空 effort 正是审计拿来对**目录 default configuration** 的桶。**max 档的分被当成 default 档的分**。
`aa-evaluations.mjs`(batch 26)**早就修了同一个坑**,它的头注释还写着 batch 14「依赖同一个约定」——
两处实现同一个约定,注释说一样不等于一样。已把 `effortFromName` 补进 batch-14 的 fetcher,
并用 `backfill-aa-reparse.mjs` 规则 2 把归档里 135 行重解回来(`note` 保着 `AA 名称 …` 原文,
所以不用 API key;守卫是名字必须真的解析出操作点,已有 effort 的行绝不覆盖)。

**方向统计**(effort 修正后重测,这才是干净的数):

| 字段 | 上升 | 下降 | 不变(±2%) | 结论 |
|---|---|---|---|---|
| `intelligence_index` | **37** | **0** | 12 | 全体单向、**零大异常** ⇒ 换了标度 |
| `cost_per_task_usd` | 3 | **21** | 15 | 强单向 ⇒ 口径变了 |
| `output_tokens_per_s` | 双向 | | | 活属性 |
| `latency_first_chunk_s` | 双向 | | | 活属性 |

37 涨 0 跌不是重测噪声。batch-14 自报 **intelligence index v4.1**,batch-06/07/08 手抄时
**没记版本号** ⇒ 证不出是哪一版,但证得出不是同一版。所以问题不是「数过期」,是
**通用能力排名在拿两把尺子互相比**,而且每加一个新模型就多一格新标度。

**做法**:`supersededRows` 加 4 条,**按字段整批**(06/07/08 的 intelligence、07 的 cost),
不逐模型 —— 决定是关于标度的,不是关于某个模型的,逐模型列等于给同一个决定开第二个家。
目录侧 51 处值用脚本改(带 old-value 守卫,第一次跑索引差一位、51 条全 MISMATCH 拒写,
**守卫比脚本本身值钱**)。

**结果**:39 处目录值移动 —— 本项目至今最大的一次数字移动。审计 323/325。

**剩下的 2 格无据是真话不是回归** `#decision`:`deepseek-v4-flash` 的目录 configuration 写
`cfg(null, …)`(没名字的操作点),而 AA 对它发布两个(`non-reasoning` 29.3、`reasoning max` 51.8),
目录那个 50 来自后者、从没标出来。改法是一个字(`null` → `"max"`),但 **effort 标签是读者看得见的**,
属于编辑判断 ⇒ 留给 owner,写进 `TODO.md`。

**顺带**:审计学会了「bare level 对上唯一一个 `<mode> <level>`」——AA 写
`(Reasoning, Max Effort)` 是 mode+level 两维,目录只写 level。**有两个候选就拒绝匹配**,
因为那正是 `_doc` 里记着的 reasoning/non-reasoning 撞格事故。实测 batch-14 复合行 6 条、零歧义。

---

## 2026-08-12（第三轮）— DeepSeek V4 Pro 转正：**先建防线，一个分都不入** `#decision` `#measure` `#gotcha`

owner 说「deepseek pro 正式版发布了，进我的观测台」。查完的结论是：**发布是真的，但今天没有
任何一个分可以进**，而真正紧急的事是另一件 —— 目录现在装的是 preview，GA 的分正要往里灌。

### 核实链（每一步都留着，因为下次还得这么查）

| 问的问题 | 答案 | 怎么得到的 |
|---|---|---|
| GA 了吗 | **是**，2026-08-12T15:42:44Z | OpenRouter `deepseek/deepseek-v4-pro-0813`，描述原文 "This is the GA release of DeepSeek V4 Pro" |
| 官方文档认吗 | 认 | `api-docs.deepseek.com` 首页把 `deepseek-v4-pro` 指向 **DeepSeek-V4-Pro-0813** |
| 有官方发布帖吗 | **没有** | changelog 中英两版最新条目都还停在 2026-07-31（带 cache-buster 重抓两次） |
| HF 有权重吗 | **没有** | `api/models?author=deepseek-ai` 最新是 `DeepSeek-V4-Flash-0731`（8-01） |
| 归档里有 GA 的分吗 | **零行** | `grep -r 0813 data/sources/` 唯一命中是 `0.000813` 这个小数 |
| 观测台自己看见了吗 | **看见了，判定还是对的** | `report:gaps` 把它列进「上游已发布、归档里什么都没有」那 5 个：「A record today draws an empty row across every column」 |

### 为什么不入库

规则 1 与规则 8 直接给出答案：没有证据就是 `N/A`，归属不猜。GA 记录今天建出来是一整行空格，
还会拉低 cell coverage。**系统已经自己算对了这件事**，我要做的不是覆盖它。

### 真正的活是防串档，而且这次是**事前**

`AGENTS.md` 里那条「One published model string can mean two different models」是 Flash 用
「LiveBench 49.25 被印成 100」换来的，**事后**才发现。Pro 现在处在同一个窗口的**第一天**：

- 目录 `deepseek-v4-pro` 的 11 格全部来自 2026-04-26 的 V4 model card ⇒ 装的是 **preview**。
  逐位核过：`hle-no-tools` 37.7 与厂商 GA 表里 `DeepSeek-V4-Pro-Preview` 那一列完全相同。
- 同族两列差 2×–5×（DeepSWE **12.8 → 62.7**、Terminal 2.1 **72.1 → 87.9**）。串一格就是事故。
- 而 `DeepSeek V4 Pro` / `DeepSeek-V4-Pro` / `deepseek-v4-pro` / `DeepSeek V4` /
  `deepseek-v4-pro-thinking` 五条 alias 现在都是 `effort: "*"` **全局通配**。
- ⚠ **闸门救不了**：跨源分歧 >20% 只在同一格已有另一个源时才响。GA 的分落在现在的**空格**上
  没有分歧可比 —— 看板上表现为「preview 记录突然变强了」，一个字都不报。

⇒ 落成 `GOTCHAS.md` **24**（判据按可靠性排：数字 > 源分不分列 > 日期；动手顺序：先 alias 再目录，
**别先改显示名**），`TODO.md` 开一节。**这一轮不动任何 alias**：GA 的分还没出现，
现在改就是在猜第一个发它的源会怎么拼 —— 那正是规则 8 禁止的事。

### 两个方法论收获

1. **`api-docs.deepseek.com` 任何路径都返回 200**（SPA fallback：`/news/news999999` 也 200，
   45KB，渲染的是 quick-start 页）。差点据此写下「0813 的发布帖已经在了」。
   ⇒ 又一次「200 不是验证」，和 `AGENTS.md` 里 HuggingFace 那条同形。**判存在要判内容，不判状态码。**
2. **owner 给的截图能被验真，方法是拿它已知的那一列去对**。那张四列表里 `Flash-0731` 一列的九项
   与官方 changelog 7-31 条目**逐位相同**，`Pro-Preview` 的 HLE 37.7 与目录现有值也逐位相同
   ⇒ 表是真的。**卡住入档的不是真实性，是 `source_url`** —— 这张表先于官方文档渠道发布，
   而本项目从来没有过 URL 指不到那张表的行。三个选项写进 `TODO.md`，交 owner 定。

---

## [2026-08-12 17:2x] 收尾：假 open-weights 标签 + 三组实测（GA 提升拆轴 / 国产开源定位 / 地板棘轮）`#ship` `#measure` `#decision` `#incident`

### 修：全目录唯一一条自相矛盾的记录

`qwen3.7-max` 的 `open` 是 `false`，tags 里却有 `"open weights"` —— 侧栏面板上
`{active.open ? "OPEN WEIGHTS" : "PROPRIETARY"}` 和 `{active.tags.map(...)}` 相隔十几个字符，
**同时**渲染 `PROPRIETARY` 和一个 `open weights` 标签。

漂的是 tag，不是 `open`：`open` 被 `check:models` 审计（`AGENTS.md`「including context window and
open-weights status」），tags 是纯编辑文案，**没有任何一条检查够得到它**。Alibaba 的 Max 档是闭源
API（开源的是 Qwen3-235B 那类数字型号）⇒ `open: false` 是对的。只删不补，行上留注释防回加。
修后 `check:models` 仍 **323/325**（tags 本来就不在分母里 —— 这正是它能漂的原因），lint 绿。

⇒ 又一格「一个事实两个来源」。判据可复用：**被审计的那份往往是对的，漂的是读者看见的那份。**

### 测一：这次后训练买到了什么（厂商表，n=11 格）

`Pro-0813` vs `Pro-Preview`，11/11 全涨，平均 **+22.5 分**、中位 **1.58x**。但平均值骗人，拆轴才是结论：

- **知识轴**（HLE 无工具，唯一一条）：37.7 → 42.7，**+5.0**（1.13x）
- **agent 轴**（其余 9 条）：均值 **+25.7**；DeepSWE 12.8 → 62.7 = **4.9x**

⇒ 买到的不是"更聪明"，是**把用工具、跑多步任务的能力从半残打开**。旁证：Flash 预览→0731 同样
11 格平均 +21.8、中位 1.59x —— **两条曲线几乎重合**，说明是同一套后训练配方分别灌到两个模型，
不是 Pro 独有的突破。复现：把图里四列敲进 python 逐格相减，数据在 `TODO.md` 那节引的官方表。

### 测二：竞品列的口径是公道的（拿归档验的）

DeepSeek 替别人跑的分**不是注水**，是拿最高档跑的：给 Opus-4.8 的 Terminal 85.0 对得上 AA 的
max 档 84.64（归档 batch-26），DeepSWE 58.0 落在归档 max 59 / xhigh 54.4 之间；Fable 5 的
DeepSWE 70.0 与归档 69.7–70 逐位吻合。**唯一虚的一格**是 Fable 5 的 Terminal 88.0（归档最高
84.64），而那列本来就标着 `w/ fallback`。
⇒ 「厂商表 = 不可信」是懒判断。**逐格拿归档核，能分出哪几格虚。**

### 测三：GA 版在国产/开源里的落点 —— 老二，老大是 Kimi K3

按厂商表的分插进目录现有排名（**混了源类，只作定位不作排名**）：K3 压着它四项
（DeepSWE 68.5/62.7 · Toolathlon 76.5/74.1 · ALE 28.3/25.7 · HLE 无工具 46.9/42.7），
DeepSeek 只在 Terminal 2.1 翻盘（87.9/85.0，全表第 3）。
⚠ 两个折扣：厂商在 system 类基准偏高本项目量过最多 +8 分（打 5 分折 Terminal 就掉到第 8-9）；
**GA 权重至今没放**（HF `deepseek-ai` 最新仍是 Flash-0731 / 8-01），严格讲它现在进不了开源榜。
⚠ 站上现挂的 `deepseek-v4-pro` 是 **preview**（Terminal 第 22/27、Toolathlon 11/11 垫底）——
`GOTCHAS.md` 24 防的就是这批分被 GA 静默顶掉。

### 决策：**不放开收录地板**（owner 提问，我给判断，owner 未推翻）

地板不是写死的 49，是**当前每模型平均格数**（1398 ÷ 29 = 48.2），所以它会**自我强化地塌**：
收一个低于平均的 → 平均降 → 门槛降 → 下一批更容易进。实测四档（`filled=1398, models=29,
benches=72`，逐档重算）：

| 收进 | 覆盖率 | 掉 | 新地板 |
|---|---|---|---|
| 只收 Flash Lite（33 格）| 66.2% | 0.7 点 | 47.7 |
| + Muse Spark 1.2（31 格）| 65.5% | 1.5 点 | 47.2 |
| 4 个有证据的全收 | 61.7% | **5.3 点** | 44.4 |
| 9 个全收（含 5 个零证据）| **53.5%** | **13.4 点** | **38.6** |

⇒ **「稍微放开一点」在机制上不存在** —— 放开一次它会自己继续放开。地板保持不动。

**但真正的不满不在门槛，在那段文案的语气**：现在它连说两句自己不是什么（"不是缺陷清单，也不是
待办"）然后折叠起来。同一份数据（9 个模型 + 发布日 + 还差多少格）正着写成「最新发布」看板，
覆盖率**一个点都不掉**（它们本来就不在分母里）。记进 `TODO.md`，等 owner 定。

**等待策略是有效的，有实测**：Flash-0731 正式版发布后第三方板一周攒了 31 行在归档里等着
（`report:gaps`「Archived rows waiting」那节）。旗舰没人不测。
**例外**：OpenAI 三个 Pro 档（Sol Pro 2 格、Luna Pro / Terra Pro 各 0 格）7 月初就发了，
一个多月没动 —— 不是等得不够久，是 Pro 属**双模型系统**，第三方板基本不测
（`model-aliases.json` 的 `_doc` 早写了这个判断）。这类等到明年也进不来，是个**与地板无关**的独立问题。

---

## 2026-08-13 — preview/GA 串号:把「发现 + 拒收」交给 cron,只留下命名决定给人 `#decision` `#ship` `#measure`

**起点是一个问题而不是一个 bug**:preview 和 GA 本来就是俩模型(跟 Flash / Flash-0731 一样),
那有没有**全自动**的应对办法。答案是有,但边界得先划清:**能全自动的是发现和拒收,不是命名**。
现在这套的危险不在于没人处理,在于处理之前那段时间它会**静默写错**;把静默改成大声缺,
时间压力就没了。做完三件,互相独立、都能单独回滚。

**一、归属闸门加第五条拒绝:带日期的兄弟串**(`propose-attribution.mjs`)
第一条拒绝比的是**同一个文件**里的两个串。它看不见真正花钱的形状 —— 源自己从不改 slug:
AA 跨过一次重训仍叫 `deepseek-v4-flash`,所以 AA 文件内部没有兄弟可比,而 LiveBench / Epoch /
LMArena 在**别的文件**里印 `-0731`。第五条把兄弟搜索跨文件展开,并收窄到只认日期后缀
(四位是最短真日期 MMDD、版本号碎片最长两位,这条界线不用维护清单)。
**有日期兄弟本身不拒绝** —— 厂商会给同一个模型发带日期的快照(`qwen3.7-max-20260517` 就是
人工这么判的);拒绝的触发条件是**拿不出正面证据**:同格吻合 = 同一个模型,冲突 = 两个,
共享零格 = 没有任何东西能 settle 它,而那正是 `GOTCHAS.md` 24 预测的形状。
`#measure` 同一份档案改前 vs 改后:reproduced **133 → 128**,contradicted **0 → 0**,
trap false-positive **0 → 0**。代价的 5 条全是 `openai-gpt-5-6-luna-*`(ARC 拼法,带日期快照
但零共享格)。另约 190 对命中全是本来就 unmapped 的上一代串,不花钱。
复现:`node scripts/propose-attribution.mjs --backtest`。

⭐ **路上查明一件事,它改变了这条链的重点**:`deepseek-v4-pro` **本来就在 escalate** ——
`batch-22-arena` 同时印了 `deepseek-v4-pro-high-preview`,第一条拒绝早就覆盖了它。
⇒ **提议路径从来不是敞口**。敞口是**已经写好的那些 alias**,任何闸门都够不着。
(这是 self-test 的前置断言失败逼出来的 —— 断言写对了,被测的假设是错的。)

**二、tags 里派生的两个改成从记录算出来**(`app/model-data.ts`)
`tags` 驱动展示、读起来像装饰,所以它旁边每个字段都长出了契约,只有它还是自由文本 ——
目录唯一一条自相矛盾就长在这(`qwen3.7-max` 的 `open` 是 false 而 tag 写着 open weights,
dossier 面板同时印 PROPRIETARY 和那个标签)。现在 `open weights` 由 `open` 渲染、`preview`
由发布名渲染,**手写任何一个都抛错**(静默过滤会把陈旧的手写 tag 留在文件里、看起来仍然权威)。
`#measure` 29/29 一致;**反向抓到一条**:`gemini-3.1-pro` 名叫 "Gemini 3.1 Pro Preview" 却
从来没有 preview 标签 —— 手写那份不只会写错,**它还漏**。抛错路径实测过(给 kimi-k3 手写
⇒ 模块加载即失败,build 全线挡住)。
`qwen3.7-max` 上那条「⚠ 不要手工加回」的告警删了:**规矩靠注释记着会被忘,靠构造函数不会。**

**三、给记录加测量窗口**(`modelWindows`,`scripts/lib/archive.mjs`)
这是唯一真正的敞口。**十个**字符串(不是 GOTCHAS 24 列的五个)以 `effort:"*"` 指向
`deepseek-v4-pro`,而那条记录装的是四月 preview 的测量。file scope 分不开 —— 同一块板、
同一个串、同一个 effort,两边只有日期不同。窗口挂在**记录**上而不是 alias 上,因为
**cutover 是一个事实**:写进十条 alias 就是十份副本,而且**第十一条(闸门下周无人值守写的
那条)一出生就没人守**。
`#measure` 关键断言:`npm run ingest` 产物**逐字节不变**,`observations.generated.ts` 没进
修改列表 ⇒ 今天零影响,是纯守卫。契约全绿(29 models · 1400/2088 · 67.0% · 溯源 323/325 ·
gaps 57 · build 过)。日期已接进**所有观测行调用点**(ingest / report-gaps / check-model-data),
不制造第二条代码路径(`GOTCHAS.md` 19 那个坑)。
⚠ **明写的洞**:未标日期的行仍放行 —— 73 行里 38 行没有 `evaluation_date`,对 null 失败关闭
等于今天丢一半现有证据、去防一批还不存在的行。`--self-test` 把这个洞**钉成断言**,
免得后人"顺手改严"时静默丢证据。

**为什么三件都配了 self-test**:这三个守卫的共同点是**在今天的数据上跟"什么都没做"无法区分**
(窗口让 ingest 逐字节不变;第五条拒绝的目标字符串至今没有任何板发过)。
⇒ **不断言就等于没有**,而且更糟:一次把规则删掉的重构会在 backtest 里表现为
「reproduction 涨了 5 点」,**看起来像改进**。三个都进了 CI。

**没做、留给你的**:preview 到底收不收 —— 见 `TODO.md` 新增那节。
⭐ 差点做错:本来要按「不收 preview」去退 `qwen3.6-max`,动手前量了一下 ——
名字带 Preview 的还有 `gemini-3.1-pro`,**59 格,全目录第二满**,Google 把 Preview 当在售
版本卖。判据是**有没有被 GA 取代**,不是名字里有没有那个词(`GOTCHAS.md` 25)。
顺带纠正一个被反复引用的数:24 和 CHECKPOINT 写的「`deepseek-v4-pro` 的 11 格」是
**四月 model card 那部分**,整条记录实测 **58 格**(`GOTCHAS.md` 26)。

---

## 2026-08-13(第二轮)— 价格链:窗口补到参数路径,并让 DeepSeek 8-16 改价那天契约自己红 `#decision` `#ship` `#measure` `#incident`

**起点是一句用户观察**:DeepSeek 官网说要涨价,能不能实时反映到性价比榜。查下去发现三件事,
一件比一件靠后:

**① 价格数据每天到,但进不了目录。** `batch-14-aa-parameters` 是脚本源
(`fetchers/artificial-analysis.mjs`),带 `price_input_per_m` 等三个字段。但 `ingest.mjs` 的参数
循环第一句就是 `if (raw.text_elo == null && raw.code_elo == null) continue` —— **参数批次里只有
Elo 进目录,价格一格都不进**。站上的价格是 `model-data.ts` 里手打的。

**② 厂商价格这条链连第一米都没有。** 12 个脚本源没有一个盯厂商定价页。档案里唯一的官方
DeepSeek 价格行在 `batch-08`,`collectedWith` 写着 "browsing model" —— **手抄的,8-01**。
⭐ 而 `check-model-provenance` 的 `priceRow` **优先采信 `source_kind === "official"`** ——
原则完全正确,但叠上"官方那份是冻住的手抄快照"就成了:**被优先采信的恰好是不会更新的那份**,
会动的 AA 行排在它后面被忽略。涨价之后契约照样全绿。这是「一个事实只设一个权威来源」的一个
新变种 —— 不是有两份副本,是**权威的那份没有活性**。

**③ 涨的不是价,是计价结构。** 实测官方页(2026-08-13 读):8-16 16:00 UTC 起改峰谷计价,
峰时 01:00–04:00 与 06:00–10:00 UTC(7 小时),谷时为峰时半价。v4-pro 输入 0.435→**1.32**(3.03×)、
输出 0.87→**3.96**(4.55×);**连谷时(0.66/1.98)都比现价贵一倍以上**。Flash 同形。
性价比榜(`intelligence / costTask`)现在 flash 1667× 第 1、luna 1110× 第 2、pro 906× 第 3;
按峰时价 pro 约掉到 216×(第 5)—— ⚠ **价格倍数是实测,costTask 倍数是推算**(AA 的 cost-per-task
按它自己的 token 配比加权,配比未知),所以"会掉"是稳的,"掉到第几"不稳。

**做了两件(user 点的 1 + 3):**

**参数行纳入记录窗口。** 昨天那道窗口只盖观测行,而价格走参数行、参数行没有 `evaluation_date`
⇒ 窗口对价格完全失效。新增 `measurementDateOf(raw, meta)`:行自己的日期优先,否则**只有声明了
`retrievedDateIsMeasurement` 的批次**才用 `retrievedDate` 兜底。
⭐ **兜底不能一刀切,这是动手前量出来的**:`batch-22-arena` 的 `retrievedDate` 恰好是 2026-08-12
(GA 当天 15:42 UTC 上线,晚于那批任何一票),而 Arena Elo 是几周累积。一刀切会删掉
`deepseek-v4-pro` 已发布的 1458/1445 两个真数,去防一件没发生的事 ⇒ `GOTCHAS.md` 27。
声明了的 8 个参数批次 retrievedDate 全 < 8-12 ⇒ **ingest 产物逐字节不变**。

**把 8-16 落档并让契约那天自己红。** batch 31(**只有 meta**:当前价与 batch-08 一致,重 archive
只是占坑重复;而 8-16 的价还没生效,写成观测行等于给一个没到的日期发布数字)。`priceTerms` 支持
第二种形状:promotion 是**带结束日**的价,`scheduled` 是镜像 —— **带生效日**的价。生效前目录提前
报新价则红,生效当天起还报旧价则**红**。`check:prices` 是日常 job 自动合并的闸门之一 ⇒ 那天
宁可停发,不发错价。

⚠ **验这件事时又踩了管道退出码**:`node … | tail -5; echo $?` 两侧都得 0,差点写下"两侧都通过"。
`$?` 是 `tail` 的。`upstream.yml` 里早写着 pipefail 是承重件(并注明 `4239916` 曾把红着的
`check:models` 直推 main)—— **规则写在别处不等于当场想得起来**。⇒ `GOTCHAS.md` 28,
并把断言落成 `scripts/check-scheduled-prices.test.mjs`(子进程读 `status`,没有管道能骗人),
实测 8-15 exit 0 / 8-16 exit 1 / 今天 exit 0,已进 CI。

**决定:价格不改用 AA 当权威,改让 AA 当哨兵。** 用户问"要不价格都按 AA,反正没促销"。
不改的理由:价格不是测量,是**售卖条款**,厂商页按定义是权威;而 AA 会把**档位结构压成一个数** ——
这次峰/谷两档 AA 只会印一个,印哪个我们不知道,等于把"目录报哪一档"这个决定悄悄外包出去
(`batch-08` 的 `tiersNotArchived` 当初就是专门定这件事的)。但用户点中的问题是真的,
所以正解是**各干各的**:官方页仍是报价权威,AA 的每日脚本行当**漂移探针** —— AA 与目录 list price
差超阈值 ⇒ 手抄的官方行过期了,报出来。比"给每个厂商写 fetcher"便宜得多,因为 AA 已覆盖所有厂商。
未做,进 `TODO.md`。

**报价规则不用重新定**:`check-price-terms.mjs` 开头已写「目录只报 list price」,而谷时价没有
`endsOn`、不是促销,是**有条件的档位**,对上 `batch-08` 的 `tiersNotArchived` 先例(Google
Batch/Flex、阿里区域价)⇒ **峰时价 = list = 目录报的那个**,谷时记录不报。两条既有惯例合起来
就是答案,不是一个新决定。

⚠⚠ **留给你的那件事变紧了**:DeepSeek 定价页只印 `deepseek-v4-flash` 和 `deepseek-v4-pro`,
**不印 `-0813`**。按 24 的判据 2,不分列的源里裸串就是在服役的那个 = **GA**。所以这两个新价属于
一个**本目录还没有记录**的模型,填进现有那条 preview 记录就是 GA 条款挂在 preview 测量上。
⇒ **先定记录身份,价格跟着身份走**,不是反过来。写进了 batch 31 的 `modelIdentityWarning`。

---

## [2026-08-13 收尾] 从 CHECKPOINT 挤出的 stale 快照(截至 8-13 的状态) `#decision`

快照涨到 174 行、超硬上限 45%,按"历史爬进快照就往 LOG 挤"处理。以下四段**截至 2026-08-13**
仍属实,但已经不是"下一个 session 要现场知道的事":

- **`qwen3.7-max` 的假 open-weights 标签(8-12 顺手修)**:同一个侧栏同时显示 `PROPRIETARY`
  和一个 `open weights` 标签,全目录唯一一条。漂的是 tag(`open` 被审计,tags 没有任何检查
  够得到)。⇒ **被审计的那份往往是对的,漂的是读者看见的那份。**
  **已于 8-13 从根上堵死**:该 tag 现由 `open` 字段派生,手写抛错(见本日第一条)。
  留在快照里已无动作可做。
- **8-12 前两轮**:Qwen 的 Max 是产品档不是 effort;`intelligence`/`costTask` 整批推到
  batch-14(39 处目录值移动,至今最大一次);AA 有 135 个模型把操作点只写在显示名里
  (`GOTCHAS.md` 21/22/23)。
- **8-10 八个 PR 全部合并并已发布**:站上线、gaps 分三层、两个分类器自测进 CI、batch 30
  脚本化、判定逻辑收进 `app/upstream-variants.ts`。
- **两条观察已退役**:分层后的 gaps issue(8-12 本地实测:上游那节折叠、只计过地板、
  三个 Pro 档都在列、零 `(batch)`/`(Fast)`,按设计工作);LMArena 天天自动提交(8-11 证实)。

顺带修掉快照里三处过期的数:`GOTCHAS.md` 写「24 条」实际 28 条;LOG 写「第六轮轮转」
实际第七轮(52a987f);现状表标题写 8-12 而表里是 8-13 实测。
⇒ **快照里引用别处的计数,每次刷新都要重新数** —— 与 `GOTCHAS.md` 26 同形。

## [2026-08-14 19:09] 报警器自己没有断言 · 价格漂移探针 · 两站图标矢量化 · Pro 记录改名 `#incident` `#ship` `#decision` `#measure`

**起点是一个问题:「我们的自动化是不是不够完善」。量了之后答案是分裂的 —— 采集侧很硬,报警侧几乎没有防线。**

- `#measure` **每日自动重读覆盖 53/72 列**(靠 14 个 live/append-only fetcher)。剩下 5 列只有 AA
  脚本(故意不每日,否则天天红 `check:models`)、6 列只有手抄行、8 列归档里没有行。
  最近七天每天都有一条 `Refresh live boards` 直接进 main,无人干预。
- `#measure` **新模型链路通到倒数第二环**:归属闸门自合过两次(#45/#58)、AA 刷新自己开过 PR
  (#48/#74/#77);但**建目录记录那一环至今 0 次**,远端从来没出现过 `auto/new-model`。
  不是坏了,是地板 49 格设计成极少触发(最接近的 `gemini-3.5-flash-lite` 发布 24 天才 33 格)。
- `#measure` **价格是三条链里唯一"看着有、其实没有"的**:价格不进 ingest,list price 手打进
  `model-data.ts`,而事后审计比的是同一份手抄快照。实测 29 个带价模型里 **3 个**与 AA 归档对不上
  (`gpt-5.6-terra` 2.5/15 vs 2/12、`claude-sonnet-5` 3/15 vs 2/10、`gpt-5.6-luna` 1/6 vs 0.2/1.2),
  没有任何检查会因此变红。
- `#incident` **今晨 07:03 的红,通知根本没发出去**,而那一步显示绿色。机制与两层吞掉见 `GOTCHAS.md` **29**。
  ⇒ 教训是可推广的一句:**这套系统防「数据错了」防得很好,防「报警器坏了」几乎没有防线** ——
  数据侧每加一个守卫都配 self-test(不断言就等于没有),通知侧零断言,而通知失败的样子是绿色。

**落地(#79–#84,六个 PR 全绿合并)** `#ship`

1. **#79** 修 SIGPIPE + `--self-test`(五条,含 dry-run 跑完整条路径)进 CI。验过有解释力:旧管道放回去两条转红。
2. **#80** `check:price-drift`:AA 当**探针不当权威**(价格是售卖条款不是测量,且 AA 把档位压成一个数)
   ⇒ exit 0、报进 gaps issue,不让日常 job 变红。阈值 10% 故意宽(最该防的失败是没人看的探针)。
   `#decision` **已声明且未过期的促销自动闭嘴** —— `claude-sonnet-5` 的 2/10 就是 `batch-10` 里带
   结束日期的促销价,目录引用 listPrice 是对的;这种会天天出现,不抑制就会把两条真的埋掉。
   过期促销反过来仍要报(那说明该退休的是条款)。self-test 17 条,含三个"读到空数据必须抛错"的方向。
3. **#81** 合并 GA 守卫分支。`ci.yml` 是唯一冲突且不是真冲突(两边都在同一处加 self-test,四条全留)。
   `#measure` **代价:站上少一格 DeepSeek V4 Pro 的 DeepSWE 62.8** —— 今晨 tier-A 刚进归档的 GA 版分数,
   被 `modelWindows` 挡在 preview 记录外。守卫按设计工作。
   顺带钉一条**会自己退休的 pin**(`deepseek-v4-pro/deepswe`):证据计数器按设计不看测量窗口,
   于是"归档里有、板上没有"在它眼里是 over-count。两边单独都测不出来,是守卫×新数据的组合才红。
4. **#82/#83** 两站图标分离并矢量化。三种生成图坏法 + 16px 量化口径见 `GOTCHAS.md` **31**。
5. **#84** `#decision` **`deepseek-v4-pro` 显示名 → "DeepSeek V4 Pro Preview"**。判据是实测:
   58 格里 37 格只有 GA 前日期、21 格无日期、**0 格**有 8-13 及之后的读数,11 格直接来自 4-26 model card;
   而厂商 GA 表把 DeepSWE 12.8→62.7、Terminal 72.1→87.9、Cybergym 52.7→83.3。
   `modelWindows` 拦住"新来的",**名字是拦住"已经在里面的"唯一那道**。
   `#deadend` **否掉了日期后缀 "0424"**:Flash 的 "0731" 是抄来的(HF 仓库名就是 `DeepSeek-V4-Flash-0731`),
   Pro 没有任何厂商日期(HF 是裸名),能拿到的全是第三方日期 —— 而 Flash 正好证明它们不能替代:
   **04-24 上架、名字写 0423**,差一天。"Pro-Preview" 是厂商 GA 表里的一列,抄的不是推的。
   `preview` 标签从显示名派生 ⇒ 只改一个字符串,ingest 逐字节不变、`describe-change` 零数字移动。

**过程中自己踩的坑**:`git add` 撞到已 `git rm` 的路径 ⇒ 整条失败什么都没 stage,而紧跟的 commit
照样成功并推出去(站上等于没图标)。已 amend + `--force-with-lease` 并核对 PR head。见 `GOTCHAS.md` **30**。
另有坑 28 第三次复发(变形:reporter 前缀不同 ⇒ 零匹配的 grep 看起来像"没跑")。

**下一步**:8-16 峰谷计价那天契约会自己红(`batch-31`);preview→GA 的翻转等 GA 读数够到地板;
两件通知侧的判断题(吞成绿色、integrity vs availability 分类)留在 `TODO.md`。

## [2026-08-15 11:30] cron 的一班活丢了,判断没丢:重做 GLM-5.2 并复核出两个错数 `#incident` `#measure` `#ship`

排程 agent 报告「改动还在工作区,尚未 commit/push」,而**没有那个工作区了** —— 本机工作树干净、
远端零分支、stash 空、悬空对象只是旧的 generated 副本。沙箱随预算一起消失,把未推送的树带走了。
机制与推广判据见 `GOTCHAS.md` **32**;章程加了硬规则 8(拿到第一件可提交的东西就推分支)。

**照它的结论重做,并逐条复核 —— 判断对,两个数字不对:**
- ✅ 星号脚注(`*: refers to their scores of full set.`)自己验了两行:带星的 GPT-5.5 41.4*/52.2*
  与不带星的 DeepSeek 37.7/48.2 **都**等于目录既有的 Full 值 ⇒ 星号不改变口径,GLM-5.2 按 Full 采。
- ❌ **「+5 格」实际 +3**:`posttrain` 34.3 与 `marathon` 13 早由 **Kimi K3 发布表**填了。
  竞品的发布表会印你的分数,而且可能比厂商自己的发布先进归档。见 `GOTCHAS.md` **33**。
- ❌ **「11 行进目录」实际 10 行**:多映了 ProgramBench(那列上目录同时有官方 0 / Vals 0.5 / 厂商 63.7)。
- 📍 页面位置报告没说清:表在 `z.ai/blog/glm-5.2`(SPA,直取 598 字节),**不在** `docs.bigmodel.cn` ——
  后者是模型卡,同样结论以散文写着、**一个数字都没有**(`.md` 原文 29KB、零表格行)。

**顺带修的两件**(都配了反向验证):
- 结果表判据:文章开头那张投机解码表(`Method | Acceptance Length`)会被读成结果表。新规则=
  行标签里一个 `carried` 都没有的表不是结果表。⚠ 影响已有批次,所以**证明**重跑 qwen3.8 与
  `batch-17` 逐字节相同(465 行)。
- `check:models` 的近似拼写检测器**排除拒绝条目**:近似撞上一条 refusal 时"这行被静默丢弃"是假的,
  拼对了也一样不映射。反向验过 main 上该发现本来就是 0,没抹掉任何真实发现。

产出:`batch-32` 123 行 × 8 列 × 18 标签,7 条竞品拒绝,9 个未映射标签带**分四类**的理由。
GLM-5.2 54→57 格,生成文件 +10 行零删失,`describe-change` 5 格来源升级、**无已有数字被改动**。

## [2026-08-15 11:43] 收尾时发现 tier-B 第三个条件此前无法触发 `#incident` `#ship`

想给两个自合脚本的逃生口清单补上新增的 `withdrawnRows`,**补完顺手验了一下 —— 没拦住**。
再查才知道补一个键名不解决问题:判据本身是坏的。
`grep '^+.*"mergedInOneSource"'` 匹配的是**给键命名的那一行**,而那行在文件一生中只出现一次 ——
引入这个键的那天。往**已存在**的键里追加条目从不碰它,而三个键今天都在配置里
⇒ **这道闸门此前根本无法触发**(实测:追加一条真条目再跑那条 grep,零输出、放行)。
- ⇒ 为什么这条重要:tier-B 三条件里前两条都有独立机制在跑,第三条「没有写例外」是唯一只靠这行
  grep 的,而它恰恰是人最难通过读 diff 复核的一条 —— 逃生口的全部意义就是"这需要一个人判断"。
- ⇒ 新增 `scripts/check-exemptions-untouched.mjs`:把问题问到**解析后的配置**上,比对每个逃生口
  的条目数,变多就 exit 1。只看变多(删例外是人在退休判断,不可能让失败的契约变绿)。CI 挂 self-test。
- ⚠ 这条是**在验证一个小改动时**掉出来的,不是审计出来的。⇒ 补丁写完顺手验一次的成本极低,
  而它这次买到的是"一个从来没生效过的安全条件"。与 `GOTCHAS.md` **29** 同族:失灵的样子是绿色。

**顺带**:LOG 轮转(第八次),41 条归档到 `LOG-archive/LOG-2026-08.md`,在册 8 条。

## [2026-08-15 收尾] 第三条路由 `/deepseek`:一个静态游戏,以及它**不带**备案页脚这个决定 `#ship` `#decision` `#incident`

**做了什么**:把另一个仓库(`../strandbound`,一个纯静态 HTML5 canvas 游戏,DeepSeek 写的)
的构建产物整目录放进 `public/deepseek/`(13 个文件 552KB,实测),站上多一条 `/deepseek`。
它是**静态资源,不是 Next 路由** —— 这个区别是下面两件事的根源。

**踩到的第一件:`public/` 下的目录没有索引解析** `#incident`
Next 只按**精确路径**服务 `public/`。本地生产构建实测:`/deepseek` → **404**,
`/deepseek/` → 308 到那个同一个 404,只有 `/deepseek/index.html` → 200。
⇒ `next.config.ts` 加 307 到 `/deepseek/index.html`。**指向文件而不是 rewrite 目录**是有原因的:
游戏的资源路径全是相对的(`game.js`、`icons/…`、`./sw.js`),在 `/deepseek/index.html` 下正确,
在裸 `/deepseek` 下会解析到上一层全断;落在真文件 URL 上也让 service worker 的 scope
(`/deepseek/`)**覆盖注册它的那个页面**,离线/PWA 才成立。307 不是 308:能分享的 URL 是
`/deepseek`,永久跳转会被每一台开过它的手机缓存,这条路由的形状就再也改不动了。

**第二件是个决定,不是 bug** `#decision`
`app/layout.tsx` 在 `{children}` 之后渲染备案条,§6 写着这样"每条路由都带它,包括以后由
没读过这一节的人加的路由"。**这条路由恰恰是那个例外**:它不走 layout,自带 HTML。
而 `check:beian` 只读 `.next/server/app/*.html` ⇒ 它**够不到**这个文件,今天照报
「3 route(s) × 1 filing(s)」全绿。owner 8-15 明确选了「先不管,直接丢进去」——
游戏全屏、PWA 可安装、离线可玩,这三样都保住。
⇒ **记在这里的理由是:绿色不是证据**。下一次有人读 `check:beian` 的输出,它说的是
"三条预渲染路由带着备案号",不是"全站带着备案号"。这与 `GOTCHAS.md` **19/29/34** 同族
(报告干净 ≠ 网站干净;失灵的样子是绿色),新开的坑 **35** 把两件都记成动手前的自查。
⇒ 要翻这个决定是**一个文件的事**:往 `public/deepseek/index.html` 里加一条 12px 的备案链接,
并让 `check:beian` 也断言这个文件(号码从 `app/beian-filing.ts` 复核,不另开一份真相)。

**实测**(本地 `next build` + `next start -p 3111`)`#measure`
- `/deepseek` 307 → `/deepseek/index.html` 200;`/deepseek/` 308 → 307 → 200;`/`、`/models`、
  `/api/live-models` 都仍是 200。
- headless Chrome(CDP 设备模拟,**生产构建**不是 dev server):844×390 与 390×844 两个尺寸
  都能启动,canvas 真的画了东西,**零 uncaught exception**;点「新游戏」后
  `localStorage` 出现 `strandbound.save.auto`,触屏摇杆 / E 键 / 菜单键都在。
  唯一的 console 噪音是 AudioContext 的 autoplay 警告(没有用户手势,预期内)。
- 游戏本身两个显示问题(**在游戏那边,不在本仓库**):844×390 横屏标题页副标题压住标题、
  菜单最后两项掉出屏幕;竖屏两行说明文字出右边界。已回报给 owner。
- `lint` / `check:data` / `check:models` / `check:prices` / `check:beian` 全 exit 0。
  `public/deepseek/**` 进了 eslint 的 globalIgnores:那是别的项目的 esbuild 产物,
  在这里报出来的是别人的风格,而且这边没有任何能动它的手。

## [2026-08-17] `/persona`:Qwen 默认候选生成 + 受保护的直接实验看板 `#ship` `#decision` `#measure`

**需求**:原来的本地 Encode Persona Dashboard 把 Codex/人工导入放在默认路径；owner 现在明确要
**Qwen 默认生成**，并把同一条候选筛选→模型实验链挂到 `quarkspace.top/persona` 随时使用。

**实现**:
- `/persona` 是新的 Next 路由，CSS 全在自己的 module；首页导航多一个入口，根 layout 自动带 ICP。
- `/api/persona/compile` 用 workspace 专属 OpenAI-compatible endpoint 调 `qwen3.7-flash`，先出
  source-quoted fact ledger，再出 2–5 个同语言不同粒度候选。候选必须过 wrapper/tag/profile/
  explicit-fact coverage 与粒度顺序校验才会回到浏览器。
- `/api/persona/run` 只发送 `system=选中候选` + `user=当前探针`，不暗加「立即入戏」类指令；
  单请求最多 6 calls、并发 2，保存精确 messages / raw response / usage / `reasoning_content` / content，
  并用与研究 harness 同版词法逻辑算 PAL/MRR/ICRR/DPE。浏览器 history 是 localStorage，
  **不是** SQLite/JSONL 的替代品。
- Qwen key 只在服务端环境变量；API fail-closed，另收 `PERSONA_ACCESS_TOKEN`。owner 指定生产口令
  「大狗」；它可猜，所以消费上限仍是承重保护，后续换口令不需改代码。
- 本地 Python Dashboard 同步把 Qwen 自动编译抬到默认面，Codex/人工导入移进「高级」折叠，
  DeepSeek/Qwen 的候选实验路径不变。

**为什么不是把 Python Dashboard 原样部署**:`quarkspace.top` 是 EdgeOne 的 Next 全栈部署，
本地 harness 的 SQLite + JSONL 文件系统语义不能假装在 serverless 上持久存在。线上版因此只承担
compile / 筛选 / 小型直接 probe / JSON 导出；完整可恢复实验与重算指标仍以 Python harness 为真源。

**实测** `#measure`:
- 真实 Qwen compile:HTTP 200、结构校验 true、29,826ms；输入很小的布奇样例仍用
  prompt 786 / total 5,038 / completion 4,252 tokens（其中 reasoning 3,617），生成 canonical 11 行、
  compact 6 行。这证明调用链和校验真的走到了模型，也说明 thinking compile 不是零成本。
- 选 canonical 跑「你是谁」:HTTP 200、5,051ms，同时拿到非空 `reasoning_content` 与 content；
  初始词法指标按保守规则给 PAL 668 / MRR 0 / ICRR 0 / DPE false，**未把没识别出的角色内 span
  猜成高分**。
- `test:persona` 3/3；全量 Python harness 24 pass + 2 integration skip；`lint`、生产 `next build`、
  `check:beian` 全 exit 0。手机生产构建在 320/390/430px 均 document=viewport、零字号/触控告警。

**尚未外发**:EdgeOne 控制台没有可用浏览器会话，本机也没有已关联的 EdgeOne CLI；生产环境变量
必须在控制台配置。Git push 按操作合同必须先拿 owner 明确许可；两步留在 `TODO.md`，没有把本地通过
写成「线上已可用」。
