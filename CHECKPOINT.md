# CHECKPOINT

**接手点** — 2026-08-19:**卡了三天的不是数据,是一个身份决定 —— 而卡住它的那把尺子量错了对象。**

`deepseek-v4-pro` 的「还差 13 格」框架 2026-08-19 被重测推翻(下面 ⭐⭐ 那段)。可推广的一句:
**一个永远满足不了的门槛,先怀疑它量错了对象,而不是继续等它被满足**(坑 **40**);
以及**一条被停掉的写路径旁边,往往有个还活着的读路径能直接回答你在猜的那件事**(坑 **41**)。

⭐ 8-15 那三件(报警链路第一次有断言并当天被真事故验证 · `withdrawnRows` 第三个逃生口 ·
tier-B 第三个条件此前无法触发)已入档 → `LOG.md` 2026-08-15 三条。**这个仓库过去所有断言都是
关于数据的,而失灵的样子是绿色**(`GOTCHAS.md` 29/32/34 同族)—— 这句仍然要记着。

⏰ **峰谷计价那天到了,契约按设计自己红了**(2026-08-16)。**flash 那半 8-17 做完**:batch 33 +
PR #92 + 把满足了的 term 移进 `retiredTerms` —— 只改价不退休 term,它会开始**断言反面**(坑 **37**)。
**pro 那半 owner 裁决「等」,继续红着** —— 而 **2026-08-19 重测把「在等什么」改了**:

⭐⭐ **不是等数据,是等一个身份决定。** 三条实测(全文 + 复算在 `LOG.md` 2026-08-19,
机制进坑 **40 / 41**,**别重新论证**):
- **地板 49 量错了对象**:`dilutionFloor` 是给**新增一条记录**用的(推导前提 `models + 1`),
  原地翻转不涨模型数 ⇒ 那把尺子不适用。「还差 13 格」这个框架从一开始就不该套。
- **GA 的 36 格不会自己涨**:被 pro term 卡住的是**入档**,不是**看见** —— `drift` job 照常读上游,
  今天 **152 格**待入档里 **V4 Pro 零命中**。8-18 那句「互锁所以涨不上去」机制对、因果反。
- **AA 那 34 行是 preview**(28 行 note 写着模型发布 2026-04-24,数值对得上厂商 Preview 列),
  ⛔ 拿它建 GA 记录就是坑 24 那场事故。PR #98 body 里「46 行 AA 在等 GA 记录」**是错的**。
⇒ **要你定**:原地翻转成 GA(29 模型,66.0%,掉 1.1pp)· 另立 GA 记录(30 模型,66.5%,但地板说不行)·
维持现状(站上继续挂四月的分)。定了价格才跟着落、term 才能退休。选项与四步动作在 `TODO.md`。

⭐ **preview 规矩已定**:一条记录 = 一个在服役的版本,preview 的行**留档不入库**(Flash 的解法);
`deepseek-v4-pro` 显示名已是 **"DeepSeek V4 Pro Preview"**。
GA 的官方发布表 8-17 已入档(**batch 35**,八列全不采纳、0 格变化),翻转那天不用再找源。
Qwen / Gemini 那两条 Preview 查过:上游精确同名且族里无 GA 取代 ⇒ 按坑 25 **不动**。

⇒ **要你定的四件**都在 `TODO.md`:通知侧两件(吞成绿色 / integrity vs availability 分类)·
ProgramBench 这一列量的是什么(同列上官方 0 / Vals 0.5 / 厂商 63.7 并存)·
⭐ 新增 **红着时 CI 只跑前 9 步要不要重排**(第一个红之后全 skip;守报警那条已挂 `if: always()`)。

**收录地板:已定「不放开」**(复算 = `npm run propose:model` 头几行),会**自我强化地塌**,
四档实测在 `LOG-archive` 2026-08-12 条,**别重新论证**。

⚠⚠ **「契约全绿」只覆盖检查够得到的东西**:判一个数有没有被守住,**grep 哪条检查真的够得到它**。
⚠ `npm run test:sites` 本机要 GNU `timeout`(macOS 没有,exit 69)—— 别把 exit 69 当通过。

Snapshot for the next session. One page. 现场状态在这里;**动手前的自查在 `GOTCHAS.md`**;
历史在 `LOG.md`;未来在 `TODO.md`。都不能替代 `AGENTS.md`——它是操作合同,改任何东西之前先读它。

---

## 现状（2026-08-15 实测）

| | |
|---|---|
| 目录 | 29 model families · **72** benchmarks |
| 观测 | **2170 rows · 1401 / 2088 cells（67.1% cell coverage）** —— 8-17 复测未变,复算 = `npm run check:data` 末行 |
| 源分类 | benchmark 920 / independent 1050 / vendor 200 |
| 溯源 | **322 / 324**（99%；2 格有值无据 = `deepseek-v4-flash`，`TODO.md` 里是编辑判断）⚠ 分母是**解析得到的行** |
| 归档 | **33 个带行的批次**（+ `batch-31` 只有 meta，是纯价格条款；编号到 **35**），其中 **20** 个 `collectedWith` 指向 `scripts/`、再加 batch-33 那条 curl（8-17 实测，复算 = 数 `data/sources/*.meta.json` 的 `collectedWith`；8-10 记的 16 已过时）⚠ 「裸奔行数」引用前先钉定义 → `TODO.md` |
| 归档里收了不入库 | **3582 行**（8-09 实测），全部带写明理由（`droppedBenchmarks` / 未映射 / 已退役）——拒绝也要可审计 ⚠ batch 35 之后**至少 +76**（那一批八列全不采纳）；这个数的取数口径没写下来，引用前先钉定义，别在它上面做减法 |
| 站点 | **`https://quarkspace.top`**（+ `www`，两个都 200）· `/` 个人站 · `/models` 观测台 · **`/deepseek` 静态游戏**（8-15 起，不走 `app/layout.tsx` ⇒ **没有备案页脚**，owner 明确选的，坑 **35**），同一个仓库，EdgeOne Pages |
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
| 09:30 | hermes（Windows 定时任务） | 读 gaps issue → 挑一件完整做完 → 开 PR / tier-B 三条件自合 | 有条件自合 |
| 任意 push 到 main | GitHub Actions `ci.yml` | 契约全套 + 归属闸门回测 + **两个分类器自测(8-10 起)** + 手机探针(两条路由) + 站上新增模型才推微信 | — |

**三条件**（tier B 自合的唯一门槛，写在 `docs/AGENT-OPERATIONS.md`）：契约全绿（含跨源分歧闸门与
一源两串闸门）· `describe-change` 报告**没有已有数字被改动** · 没有写 `acknowledgedDisagreements`
或 `mergedInOneSource`、`withdrawnRows` 例外（由 `scripts/check-exemptions-untouched.mjs` 比对条目数判定 —— 旧的 grep 判据够不到,见 `GOTCHAS.md` 34）。

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
8-06 的四条），策略是「只在异常时说话」；逐条落在哪个 workflow、砍掉的六条为什么砍
→ `docs/ARCHITECTURE.md` §10。⭐ **`main 变红` 那条 8-17 起按「红的集合变化」推**，同一个红每天
最多提醒一次，读不出来一律推 —— **沉默 = 没变，不是绿了**（坑 **38**）。⚠ 它的 stdout **就是消息**，
诊断只能走 stderr，守它的自测挂了 `if: always()`（坑 **39**）。
**沉默可诊断**：两个调度器互相看守，阈值理由在
`scripts/check-heartbeat.mjs` 头部。⚠ 这个互相看守是**不对称**的（§10 末尾）。

---

## 现在要盯的三件事

1. ⏰ **`check:prices` 红着,而且要它红着** —— 见接手点。⚠ 代价现在是可量的:refresh job 的
   **入档**过不去 ⇒ 2026-08-19 实测 **152 格**待入档(LiveBench 46 · Epoch 34 · GDPval-AA 36 ·
   Vals 27 · FrontierMath 6 · LMArena 2 · ALE 1,复算 = `FETCH_TIMEOUT_MS=60000 npm run check:upstream`)。
   ⭐ 而这是一条**假依赖**:`check-price-terms.mjs` 只读手写的 `priceTerms` 与手写的
   `MODELS[].price`,一次 tier-A refresh 不可能改变它的判定(零个写者)。⇒ 「把它在 refresh 里
   降成只报、在 `ci.yml` 上仍然硬红」立成待决,在 `TODO.md`,**和身份题分开定**。
2. **`deepseek-v4-pro` 的身份题**(见接手点):**36 格不是「还在爬」也不是「被扣着」**,
   而是活板目前只发了这么多;地板 49 量的是别的东西。⚠ 照 `GOTCHAS.md` 24 的顺序,
   **先 alias 再目录**;⚠ 厂商发布表(batch 35)按设计整批不计入证据。
3. **`swe-pro` 第一次自己动**（batch 30 是 `live`）。它读 RSC flight,**不是稳定 API** ——
   挂了应当是**大声 throw**(六条断言),不该是"看板变小了"。见 `docs/ARCHITECTURE.md` §9。

⭐ 三个新机制都已实战验证过(8-15):报警链路真红时 issue 与微信都发出来了 · 价格探针在跑 ·
`withdrawnRows` 逃生口让日常 job 从每天红回到绿。

---

## 该读哪份文档

| 文件 | 什么时候读 |
|---|---|
| `AGENTS.md` | **动手之前必读**。操作合同、九项检查、已经踩过的坑 |
| `docs/ARCHITECTURE.md` | 架构、数据政策、§9 采集现状与每个源的判定、§10 已知限制与下一步 |
| `docs/AGENT-OPERATIONS.md` | 排程 agent 的章程：三个风险层级、硬规则、alias 归属规则 |
| `docs/UI.md` | 改任何界面之前：字号地板、断点、手机契约 |
| `docs/INGEST-PROMPT.md` | 要让一个浏览模型抄一批数据时的转录合同 |
| `GOTCHAS.md` | **动手之前扫一遍**：**41** 条仍会咬人的坑，编号稳定可引用（复算 = `grep -c '^### ' GOTCHAS.md`）。**它自己顶部有一张「你要动 X 就先读 N」的表**，别在这里维护第二份。 |
| `TODO.md` / `LOG.md` | 接下来做什么 / 以前为什么这么做。⚠ LOG 轮转过多次（现存档见 `ls LOG-archive/`）——检索一律 `grep LOG.md LOG-archive/*.md` 两边一起搜 |

Git 状态一律现查（`git log --oneline -5`、`git status`），这里不记 HEAD、不记分支进度。
