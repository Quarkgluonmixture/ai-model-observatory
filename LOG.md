# LOG

Append-only。发生了什么，以及**为什么**。做完的事从 `TODO.md` 删掉之后，它的理由留在这里。

标签固定五个，可多标：`#decision`（决定做/不做/回退）· `#measure`（测量结果，**必须带 n / 日期 /
怎么复现**）· `#deadend`（试过不行，连同排除它的证据）· `#incident`（踩坑/事故）· `#ship`（落地）。

**更早的条目已轮转到 `LOG-archive/LOG-2026-08.md`（26 条，至 2026-08-09 第二轮）。**
轮转不该让旧条目失联——检索一律两边一起搜：

```bash
grep -n '^## '     LOG.md LOG-archive/*.md   # 全量目录
grep -n '#deadend' LOG.md LOG-archive/*.md   # 试过什么不行
grep -n -A4 '#measure' LOG.md LOG-archive/*.md   # 所有数字连同出处
```

---

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

## [2026-08-10 17:29] Session 收尾:第 8 个 PR 上线 + LOG 第六轮轮转  #ship #measure

- **#ship PR #72 合并并已发布**。线上实测(不是读代码):合并前 `total=None shown=8`(旧版,
  含 5 条档位)→ 发布后 `total=6 shown=6`,零档位,**被挤掉的三个 Pro 都露出来了**。
  `check:deployment` 绿(生产与 main 一致),折叠文案确实在已发布的 chunk `0weqi4lnk7d49.js` 里
  —— 「本地过了」和「线上是这一版」是两件事,分别验的。
- 今日共 **8 个 PR**(#65–#72,实测 `gh pr list --state merged` 按 mergedAt 过滤,不是数记忆)。
- **LOG 第六轮轮转**:667 行 / 17 条 → 最早 7 条并入 `LOG-archive/LOG-2026-08.md`(19 → 26 条),
  live LOG 留 10 条 / 363 行。账目对得上(667 = 363 + 304),七个标题逐个核过 archive 有、LOG 无。
- **#measure TODO 那条「明早(8-08)验三件事」过期两天,实测后只删掉一件**:
  ③ `auto/attribution` 8-08 确实开了 #58 ⇒ 删;① `auto/refresh-aa` 该分支只有 8-07 的 #48、
  之后没有新的 ⇒ 「`Argument list too long` 修好了」**从未被观测证实**,只是没再报错;
  ② 「Is the queue being worked?」那一节在 `report-gaps.mjs` 里 **grep = 0**,根本不存在。
  ⇒ 教训与今天的主线同形:**「没再报错」不等于「被证实跑通了」;「期待写在 TODO 里」不等于
  「代码里有」**。已把这条重写成实测后仍未决的两件,而不是整条删掉充当做完。

## [2026-08-11] 三条「文档说的」被实测推翻,其中一条是 §10 自己  #measure #incident #decision

今天的 cron 报告说 PR #74 已 merge-ready、采集队列无活可干。核 PR 时顺手把 CHECKPOINT 与 TODO 里
「等观测证实」的条目逐个对今天的产物量了一遍,三条翻了。

- **#measure ① `auto/refresh-aa` 自己开 PR —— 证实了。** #74 就是它开的,`gh: Argument list too
  long` 确实修好了。TODO 里那条「从未被观测证实」可删。CI run `31479167215` 的 `headSha` 与
  `gh pr view` 的 `headRefOid` 逐字一致(3adb53b),测的是当前 head 不是旧提交。
- **#incident ② 「Is the queue being worked?」不是没建,是我上一轮 grep 错了地方。** 它在
  `upstream.yml:118-123`,直接 `node scripts/check-heartbeat.mjs --agent` 拼进 `gaps.md`——
  按 npm script 名 `check:heartbeat` 去 grep 永远找不到它。**教训:负面结论换一种拼法再问一遍**,
  尤其是「grep = 0 所以没建」这种用输出证明输入不存在的推断。真正留下的半个问题是 `--agent`
  分不清 agent 与 owner,答的是「队列有没有人做」而不是「hermes 活着吗」。
- **#incident ③ §10 那句「AA's index fills itself in later, on a normal refresh, with no code
  change」——证伪。** 刷新如期到了(#74),`qwen3.8-max` 仍是全目录唯一一个 intelligence 为 null
  的记录。根因不在刷新脚本:AA 参数 API 把旗舰拼成**裸词干 + 档位单列**(`qwen3-8`/`max`),
  四条(`qwen3-8`/`qwen3-7`/`qwen3-6`/`qwen3`)`resolveModelId` 全 undefined;
  `check-model-provenance.mjs:71` 对解析不到的行直接跳过 ⇒ **它们连被检查的资格都没有**。
  所以「321/321 backed · 0 contradictions」为真,而它的**范围是解析得到的行**。
  ⚠ 光加别名也不行:`:219` 按 `id|effort` 分桶,这条记录的 configuration effort 是 `null`,
  带 `max` 的行落进 `|max` 桶,对那一格依然不可见。而 `max` 在 `claude-opus-5_max` 上是真 effort
  ⇒ 没有一刀切的规则。**这是「厂商拿 Max/Plus 当产品档、目录拿 effort 当维度」的语义冲突**,
  是判断题,写进 TODO 待裁,没有替你定。
  代价不只是那条空记录:`qwen3.7-max` 的 cost 目录写 1.28(有据,来自 batch-07/08 的**旧** AA
  读数),AA 现在这一行是 0.5413,**差 2.4 倍**,而漂移闸门看不见 ⇒ 站上挂着过期的旗舰成本。
  **一个任何检查都够不到的数字,不是被检查过的数字** —— 和「报告干净≠网站干净」同形,低一层。
- **#decision 没有替你合 #74,也没有替你补别名。** 前者被本地权限分类器拦下(`gh pr merge`),
  后者按章程本就不该无人值守做:合并那一刻 `qwen3.7-max` 的 cost 会移动,正撞三条件第二条。
- **#measure 一个数字的两份副本对不上,已在 §10 就地标注**:§10 写「1,287 rows at risk」,
  TODO 写「这个数复现不出来(1,404 / 1,226)」。同一个问题两个文档两个答案,正是单一真源要防的。
  没有写第三个数,只在 §10 标了「争议中、钉死判定式之前不要引用」。
- **#ship 个人站那条 Kaggle 文案换成最终结果**:private 0.780 · 571 队第 131(真相源
  `autonomous-agent-prediction-beta/docs/final-results.md`,含复算命令)。原文「public 约 0.817,
  130 队里前三分之一」是赛中快照,名次也不对(public 实为 286/571)。新文案带上竞争带
  Spearman 0.142 这个赛后结论——追了一整场的那个分数几乎不预测最终成绩。
