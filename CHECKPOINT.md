# CHECKPOINT

**接手点** — 2026-09-04:**「每周合一次 AA 的 PR」这件事没了。** owner 的原话是「我总得手动合 PR,
我不想看,我就想让他更新」,所以这一轮拆的是**重复劳动**,不是判断:

- `auto/refresh-aa` 现在自己对账、自己合。`scripts/reconcile-aa.mjs` 只把重测过的
  **`speed` / `latency`** 抄进目录记录(这两个字段「归档是新的、目录是旧的」**按构造为真**),
  其余字段一律拒绝,**一条不合就整个不写**。四条件全绿才自合 —— 契约绿 · 零升级 ·
  零观测格移动 · 没人在这条 PR 上动过手。
- `docs/AGENT-OPERATIONS.md` 的 tier-B 从「**可以**自合」改成「**就该**自合」。旧措辞被
  hermes 读成「默认开 PR」(#109 的 body 自己这么写的),于是三条 CI 全绿的 PR 开了 10 天。
- ⛔ **别把 reconciler 当成「碰 `model-data.ts` 就要人」这条规矩被推翻了**:它是一个**窄例外**,
  两个参数位、只在已存在的记录上、只抄归档已发布的值。要放宽它是一次决定,不是维护性修改。

⇒ **剩下真的要你定的四件在 `TODO.md` 顶部那一节**(三条开着的 PR + 一条 tier-C),
每条都写了它卡在哪个条件上。⛔ 那些不是漏做的自动化。

⛔⛔ 仓库 2026-08-26 已改名 `ai-model-observatory` → `quarkspace`;**永远不要再建旧名的仓库**,
`…-lhi0hg2y.edgeone.cool` 是 EdgeOne 项目名派生的域名、**不许顺手替换**。全文 → 坑 **49**。

同一轮修掉了一个**指反了三天**的真相源:`AGENTS.md` 曾写着「更完整的真相源在
`../quark-space/content/projects.json`」。⚠ `AGENTS.md` 是操作合同,hermes 和任何动首页的 agent
都先读它 ⇒ 指反了 = 下一个执行者照着一份冻结快照改线上文案。**这仓库 30 个 npm script
没有一个校验散文**,所以零告警地错了三天。现在的权威是三层,别再压平成一句 "source of truth":
职业事实/定位 → `JobFinder/00_总控/` · 线上首页文案/选择/排序 → `app/home-content.ts` ·
历史设计快照 → quark-space(**2026-08-26 已 GitHub archived,只读**),⛔ 不得回灌。

⭐ **个人站 `/` 现在在本仓库 `TODO.md` 里有自己那一节了**(此前没有,待办锁在 quark-space)。
迁移时逐条验过,原本 7 条**只剩 2 条**成立 —— ⇒ **搬待办前先验它还成不成立**。

⭐ 8-19 那一整轮(`deepseek-v4-pro` 原地翻转成 GA、守卫从日期换成串、batch 35 的 GA 列采纳)
已全部落地并入档 → `LOG.md` 2026-08-19 三条 + 坑 **40/41/42/43/44/45**。**⛔ 别重新论证**,
翻转留下的两件小尾巴(`open` 无据 · `value` chip 还算不算数)在 `TODO.md`,都不急。

⛔ **已定、别重新论证的两条**:**preview 规矩** —— 一条记录 = 一个在服役的版本,preview 的行留档不入库
(Qwen / Gemini 那两条上游精确同名且族里无 GA 取代 ⇒ 按坑 **25** 不动);**收录地板不放开** ——
会自我强化地塌,四档实测在 `LOG-archive` 2026-08-12 条(复算 = `npm run propose:model` 头几行)。

⇒ **要你定的都在 `TODO.md`**,标 ⭐ 的就是(**这里不维护第二份清单**,复算 =
`grep -n '⭐ \*\*要你定\|⭐ 要你定' TODO.md`)。

⚠⚠ **「契约全绿」只覆盖检查够得到的东西**:判一个数有没有被守住,**grep 哪条检查真的够得到它**。
⚠ `npm run test:sites` 本机要 GNU `timeout`(macOS 没有,exit 69)—— 别把 exit 69 当通过。

Snapshot for the next session. One page. 现场状态在这里;**动手前的自查在 `GOTCHAS.md`**;
历史在 `LOG.md`;未来在 `TODO.md`。都不能替代 `AGENTS.md`——它是操作合同,改任何东西之前先读它。

---

## 现状（2026-08-26 实测）

| | |
|---|---|
| 目录 | 29 model families · **72** benchmarks |
| 观测 | **2160 rows · 1391 / 2088 cells（66.6% cell coverage）** —— 8-26 实测（8-20 是 2155 / 1390 / 66.6%），复算 = `npm run check:data` 末行 |
| 源分类 | benchmark 921 / independent 1044 / vendor 195（8-26 实测；较 8-20 +0 / +5 / +0）|
| 溯源 | **319 / 322**（99%；3 格有值无据 = `deepseek-v4-flash` 两格 + `deepseek-v4-pro` 的 `open`，都在 `TODO.md`）⚠ 分母是**解析得到的行** |
| 归档 | **34 个带行的批次**（+ `batch-31` 只有 meta，是纯价格条款；编号到 **35**），其中 **20** 个 `collectedWith` 指向 `scripts/`、再加 batch-33 那条 curl（8-20 实测，复算 = 数 `data/sources/*.meta.json` 的 `collectedWith`）⚠ 「裸奔行数」引用前先钉定义 → `TODO.md` |
| 归档里收了不入库 | **3582 行**（8-09 实测），全部带写明理由（`droppedBenchmarks` / 未映射 / 已退役）——拒绝也要可审计 ⚠ 只增不减地长过两次（batch 35 之后至少 +76；8-19 又加进 V4 Pro preview 的全部 132 行）；这个数的取数口径没写下来，引用前先钉定义，别在它上面做减法或加法 |
| 站点 | **`https://quarkspace.top`**（+ `www`，两个都 200）· `/` 个人站 · `/models` 观测台 · **`/deepseek` 静态游戏**（不走 `app/layout.tsx` ⇒ **没有备案页脚**，owner 明确选的，坑 **35**），同一个仓库，EdgeOne Pages |
| Persona Lab | **`https://quarkspace.top/persona` 已上线**（2026-08-17 实测）：`qwen3.7-flash` 快速候选编译 + 候选筛选后直接探针；服务端凭据已配置且访问口令受保护。线上保存浏览器本地历史，完整 SQLite/JSONL 研究实验仍走本地 Encode Persona harness。 |

⚠ **三个数字一起读，别只读百分比**——加一个基准会同时放大分母。

**域名 / 备案已定案**（细节 → `docs/ARCHITECTURE.md` §6）。⏳ 只剩公安联网备案约 2026-09-09 出结果，
批了**只改一个常量**：`app/beian-filing.ts` 的 `PUBLIC_SECURITY_FILING`（现在是 `null`），
两个 check 不用改一个字就会开始断言它。

**自动化真正剩下的**看 `TODO.md`。⭐ **「上游有、目录没有」不是缺陷清单**,且它**由两处独立算出**
(`report:gaps` 与 `app/api/live-models/route.ts`),判定逻辑只有一个家 `app/upstream-variants.ts`。
⚠⚠ **报告干净 ≠ 网站干净** → `GOTCHAS.md` 19 + `docs/ARCHITECTURE.md` §6。

---

## 自动化链路：谁在什么时候跑什么

| 时间（UTC） | 在哪 | 做什么 | 能不能自己合并 |
|---|---|---|---|
| ~08:10（cron 写 06:00，GitHub 实际延迟约两小时） | GitHub Actions `upstream.yml` | **14** 个每日源漂移检查（16 个 fetcher 中 `live`/`append-only` 那些；复算 = `npm run report:column-automation`） → 重抓 live 板 → 发布页探针 → 写 gaps issue → AA 新模型侦测 | 只碰 `data/sources/` + 生成文件 → **直推 main** |
| 同上，末步 | GitHub Actions | 归属闸门 `attribute-and-merge.sh`：提议 alias → 跑契约 → 三条件满足才自合 | 有条件自合，否则留 PR |
| 由 `upstream.yml` 末步按需触发 | GitHub Actions `aa-refresh.yml` | 重读 AA 参数 → `reconcile-aa.mjs` 把重测的 speed/latency 抄进目录 → 契约(**现在是闸**) → 开 PR → 四条件自合 | 有条件自合，否则留 PR |
| 09:30 UTC（10:30 UK） | hermes（Windows 定时任务，canonical job id **`2d4dbdc7db6f`**） | 读 gaps issue → 挑一件完整做完 → 开 PR → **四条件全真就合并并删分支**（2026-09-04 起是指令不是许可） | 有条件自合 |
| 任意 push 到 main | GitHub Actions `ci.yml` | 契约全套 + 归属闸门回测 + 两个分类器自测 + 手机探针（两条路由）+ 站上新增模型才推微信 | — |

**三条件**（tier B 自合的唯一门槛，写在 `docs/AGENT-OPERATIONS.md`）：契约全绿（含跨源分歧闸门与
一源两串闸门）· `describe-change` 报告**没有已有数字被改动** · 没有写 `acknowledgedDisagreements`
或 `mergedInOneSource`、`withdrawnRows` 例外（由 `scripts/check-exemptions-untouched.mjs` 比对条目数判定 —— 旧的 grep 判据够不到,见 `GOTCHAS.md` 34）。

⚠ 2026-09-04 起这三条是**指令**:全真就合并并删分支,不真就留 PR 并**点名是哪一条**。
「和相关 PR 一起看」不是第五条件 —— 把能合的压在不能合的后面正是那 10 天的成因。

闸门的 hands-off 判据是 branch-scoped —— 见 `GOTCHAS.md` 坑 13。

---

## Ops 速查

```bash
npm ci
npm run ingest          # 归档 + alias → app/observations.generated.ts（且派生 ARENA_ELO）
npm run lint
npm run check:data      # 观测契约 + 覆盖率
npm run check:models    # 目录每个数字 vs 归档
npm run check:prices    # 促销价是否混进目录
npm run build
npm run check:beian     # 备案号是否进了每一条预渲染路由(读上面 build 的产物)
```

`npm run check:mobile` 在 CI 里跑（两条路由）。本地跑前先看 `GOTCHAS.md` 坑 11。

其他常用：

```bash
npm run propose:attribution            # 归属闸门今天能定多少
npm run propose:attribution -- --backtest   # 回测 300 条人工判断（CI 里也跑）
npm run describe-change origin/main    # 这次改动对已发布看板做了什么
npm run report:gaps                    # 什么从来没被采集过
npm run check:upstream                 # 14 个每日源逐格对照
npm run report:column-automation       # 72 列里多少列是每日自动重读的
npm run check:price-drift              # 手抄的 list price 是否落后于 AA
node scripts/fetch-source.mjs arcprize # 单独重抓一个源（arcprize / arcprize-v1 / arcprize-v3）
```

**推送前**：`gh auth switch -u Quarkgluonmixture`（个人账号）。仓库密钥：`AA_API_KEY`、
`PUSHPLUS_TOKEN`，两个都是可选的——缺了对应步骤跳过自己，不会让任何检查变红。

**微信推送 7 条**（复算 = `grep -rn notify-pushplus .github/workflows scripts`；⚠ §10 的表还停在
8-06 的四条），策略是「只在异常时说话」；细节 → `docs/ARCHITECTURE.md` §10 + 坑 **38/39**
（`main 变红` 按「红的集合变化」推，**沉默 = 没变，不是绿了**；它的 stdout 就是消息）。
**沉默可诊断**：两个调度器互相看守（`scripts/check-heartbeat.mjs` 头部），⚠ 但这个看守是**不对称**的。

---

## 现在要盯的三件事

1. **`auto/refresh-aa` 的第一次真实自合**,以及 hermes 拿到新章程后的第一班。
   两件都只能在真跑里验:GitHub 的 step output 传递(`handsoff`/`escalated`/`moved`)本地验不了,
   hermes 会不会真的按新措辞合并也一样。**它死掉是这套系统里唯一背后没有推送的失败** ⇒
   不会报丧,只会安静地不干活。
   ⛔⛔ **别用 `npm run check:heartbeat -- --agent` 判断 hermes** —— 那条量的是「队列有没有人在做」,
   你自己开一次 session 就把时钟清零(2026-08-26 当场实测:它拿我们自己的 commit 报了绿)。
   ⚠ 它与其他 glm-5.3 重活**共享同一个 5 小时配额窗口** ⇒ 延迟先怀疑配额。
2. **`deepseek-v4-pro` 翻转后的两件小尾巴**(都在 `TODO.md`,都不急):`open` 现在无据 ·
   `value` 这个 chip 还算不算数。
3. **`swe-pro` 第一次自己动**（batch 30 是 `live`）。它读 RSC flight,**不是稳定 API** ——
   挂了应当是**大声 throw**(六条断言),不该是"看板变小了"。见 `docs/ARCHITECTURE.md` §9。

---

## 该读哪份文档

| 文件 | 什么时候读 |
|---|---|
| `AGENTS.md` | **动手之前必读**。操作合同、九项检查、已经踩过的坑 |
| `docs/ARCHITECTURE.md` | 架构、数据政策、§9 采集现状与每个源的判定、§10 已知限制与下一步 |
| `docs/AGENT-OPERATIONS.md` | 排程 agent 的章程：三个风险层级、硬规则、alias 归属规则 |
| `docs/UI.md` | 改任何界面之前：字号地板、断点、手机契约 |
| `docs/INGEST-PROMPT.md` | 要让一个浏览模型抄一批数据时的转录合同 |
| `GOTCHAS.md` | **动手之前扫一遍**：仍会咬人的坑，编号稳定可引用（复算 = `grep -c '^### ' GOTCHAS.md`）。**它自己顶部有一张「你要动 X 就先读 N」的表**，别在这里维护第二份。 |
| `TODO.md` / `LOG.md` | 接下来做什么 / 以前为什么这么做。⚠ LOG 轮转过多次（现存档见 `ls LOG-archive/`）——检索一律 `grep LOG.md LOG-archive/*.md` 两边一起搜 |

Git 状态一律现查（`git log --oneline -5`、`git status`），这里不记 HEAD、不记分支进度。
