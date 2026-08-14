# CHECKPOINT

**接手点** — 2026-08-14:**通知侧第一次有了断言;价格第一次有了漂移探针;Pro 记录的名字不再骗人。**

今天的问题不是"自动化够不够",而是**它防哪一类失败**。量出来是分裂的:采集侧很硬
(**72 列里 53 列每日自动重读** —— 8-14 实测,复算 = `npm run report:column-automation`;
七天里天天有一条 `Refresh live boards` 直推 main);
报警侧几乎没有防线 —— 07:03 那次 job 红了,**通知一个都没发出去,而那一步显示绿色**,
人是十小时后翻 Actions 才发现。⭐ 可推广的一句:**这个仓库所有断言都是关于数据的,
而通知失败的样子是绿色**。机制见 `GOTCHAS.md` **29**(报警器在正比于它要报的规模上失灵)。

本日落地四件,理由与实测在 `LOG.md` 2026-08-14 条:报警链路修好并**第一次有了 self-test**(进 CI)·
`check:price-drift` 上线(AA 当探针不当权威 ⇒ 只报不红,已声明促销自动闭嘴)· GA 守卫分支合入 ·
两站图标分离并矢量化。

⭐ **preview 规矩已定**:一条记录 = 一个在服役的版本,preview 的行**留档不入库**(Flash 的解法);
`deepseek-v4-pro` 显示名已改 **"DeepSeek V4 Pro Preview"**(`preview` 标签从名字派生)。
剩下**只等数据**不等决定 —— 四步动作在 `TODO.md`。Qwen / Gemini 那两条 Preview 查过:
上游精确同名且**族里无 GA 取代** ⇒ 按 `GOTCHAS.md` 25 **不动**。

⏰ **2026-08-16 16:00 UTC · DeepSeek 换峰谷计价**,契约自己会红(`batch-31`,实测 8-15 exit 0 /
8-16 exit 1)。按 `quotingRule` 用**峰时价**重抓入档 → 改记录 → 退休该条款。
⚠ 报的是 `deepseek-v4-flash`,与上面 Pro 那条 preview 记录**不是一回事**。

⇒ **要你定的**:通知侧两件(吞成绿色 / integrity vs availability 分类)在 `TODO.md` 顶部一节。

**收录地板:已定「不放开」**。它不是写死的数,是当前每模型平均格数(复算 = `npm run propose:model`
头几行会打印它),所以会**自我强化地塌**。四档实测在 `LOG.md` 2026-08-12 收尾条,**别重新论证**。

⚠⚠ 通用判据:**「契约全绿」只覆盖检查够得到的东西**。判一个数有没有被守住,
**grep 哪条检查真的够得到它**,别问「有没有这个检查」。
⚠ 本机 `npm run test:sites` 需要 GNU `timeout`(macOS 没有,exit 69)—— **别把 exit 69 当跳过即通过**。

Snapshot for the next session. One page. 现场状态在这里;**动手前的自查在 `GOTCHAS.md`**;
历史在 `LOG.md`;未来在 `TODO.md`。都不能替代 `AGENTS.md`——它是操作合同,改任何东西之前先读它。

---

## 现状（2026-08-14 实测）

| | |
|---|---|
| 目录 | 29 model families · **72** benchmarks |
| 观测 | **2165 rows · 1403 / 2088 cells（67.2% cell coverage）** —— 8-14 实测,复算 = `npm run check:data` 末行 |
| 源分类 | benchmark 920 / independent 1055 / vendor 190 |
| 溯源 | **323 / 325**（99%；2 格有值无据 = `deepseek-v4-flash`，`TODO.md` 里是编辑判断）⚠ 分母是**解析得到的行**，见下 |
| 归档 | **30 batches，其中 16 个可脚本重读**（8-10 实测 `meta.collectedWith`）⚠ 「裸奔行数」引用前先钉定义 → `TODO.md` |
| 归档里收了不入库 | **3582 行**，全部带写明理由（`droppedBenchmarks` / 未映射 / 已退役）——拒绝也要可审计 |
| 站点 | **`https://quarkspace.top`**（+ `www`，两个都 200）· `/` 个人站 · `/models` 观测台，同一个仓库，EdgeOne Pages |

⚠ **三个数字一起读，别只读百分比**——加一个基准会同时放大分母。走势见 `LOG.md`。

**域名 / 备案已定案**（两个域名 × 两条路由的服务端 HTML 都渲染 ICP，`check:deployment` 绿）——
细节与三步绑定顺序 → `docs/ARCHITECTURE.md` §6。⏳ 只剩：公安联网备案约 2026-09-09 出结果，批了**只改一个常量** ——
`app/beian-filing.ts` 的 `PUBLIC_SECURITY_FILING`（现在是 `null`）;`site-beian.tsx` 只渲染它,
`check:beian` / `check:deployment` 不用改一个字就会开始断言它。

**自动化真正剩下的**看 `TODO.md`。⭐ **「上游有、目录没有」不是缺陷清单**,且它**由两处独立算出**
(`report:gaps` 与 `app/api/live-models/route.ts`),判定逻辑只有一个家 `app/upstream-variants.ts`。
⚠⚠ **报告干净 ≠ 网站干净** → `GOTCHAS.md` 19 + `docs/ARCHITECTURE.md` §6。

---

## 自动化链路：谁在什么时候跑什么

| 时间（UTC） | 在哪 | 做什么 | 能不能自己合并 |
|---|---|---|---|
| ~08:10（cron 写 06:00，GitHub 实际延迟约两小时） | GitHub Actions `upstream.yml` | **12** 个脚本源漂移检查 → 重抓 live 板 → 发布页探针 → 写 gaps issue → AA 新模型侦测 | 只碰 `data/sources/` + 生成文件 → **直推 main** |
| 同上，末步 | GitHub Actions | 归属闸门 `attribute-and-merge.sh`：提议 alias → 跑契约 → 三条件满足才自合 | 有条件自合，否则留 PR |
| 09:30 | hermes（Windows 定时任务） | 读 gaps issue → 挑一件完整做完 → 开 PR / tier-B 三条件自合 | 有条件自合 |
| 任意 push 到 main | GitHub Actions `ci.yml` | 契约全套 + 归属闸门回测 + **两个分类器自测(8-10 起)** + 手机探针(两条路由) + 站上新增模型才推微信 | — |

**三条件**（tier B 自合的唯一门槛，写在 `docs/AGENT-OPERATIONS.md`）：契约全绿（含跨源分歧闸门与
一源两串闸门）· `describe-change` 报告**没有已有数字被改动** · 没有写 `acknowledgedDisagreements`
或 `mergedInOneSource` 例外。

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

`npm run check:mobile` **2026-08-07 起进了 CI**（两条路由都探）。本地跑要 Chrome +
`PORT=3111 npm run start:next`，**跑完必须停掉那个 server**——见 `GOTCHAS.md` 坑 11。

其他常用：

```bash
npm run propose:attribution            # 归属闸门今天能定多少
npm run propose:attribution -- --backtest   # 回测 300 条人工判断（CI 里也跑）
npm run describe-change origin/main    # 这次改动对已发布看板做了什么
npm run report:gaps                    # 什么从来没被采集过
npm run check:upstream                 # 16 个脚本源逐格对照
node scripts/fetch-source.mjs arcprize # 单独重抓一个源（arcprize / arcprize-v1 / arcprize-v3）
```

**推送前**：`gh auth switch -u Quarkgluonmixture`（个人账号）。仓库密钥：`AA_API_KEY`、
`PUSHPLUS_TOKEN`，两个都是可选的——缺了对应步骤跳过自己，不会让任何检查变红。

**微信推送 7 条**（2026-08-07 从 4 条补到 7）：站上新增模型 · 归档完整性失败/恢复 ·
AA 刷新 PR 没开成 · AA 刷新整体失败 · **main 检查变红**（EdgeOne 合并即发布不看 CI ⇒
「站已上线且契约在失败」）· GitHub 每日 job 超 36h。策略仍是「只在异常时说话」，
补的三条是这条通道**够不着的那几个异常**。逐条落在哪个 workflow、砍掉的六条为什么砍
→ `docs/ARCHITECTURE.md` §10。

**沉默可诊断**：两个调度器互相看守（hermes 查 GitHub 36h→推微信；每日 job 查 main 最近
非 bot 提交 3 天→只写 gaps issue）。阈值理由在 `scripts/check-heartbeat.mjs` 头部。

---

## 现在要盯的三件事

1. ⏰ **2026-08-16 峰谷计价** —— 见接手点。契约自己会红;**身份没定就让它红着**。
2. **`deepseek-v4-pro` 的 GA 读数往上爬**（8-14 已到第一格:DeepSWE 62.8,被窗口拦住）。
   够到地板才翻转,动作四步写在 `TODO.md`;⚠ 照 `GOTCHAS.md` 24 的顺序,**先 alias 再目录**。
3. **`swe-pro` 第一次自己动**（batch 30 是 `live`）。它读 RSC flight,**不是稳定 API** ——
   挂了应当是**大声 throw**(六条断言),不该是"看板变小了"。见 `docs/ARCHITECTURE.md` §9。

⭐ 明晨 07:00 UTC 那次 job 是三个新东西的第一次实战:价格探针往 gaps issue 写一节 ·
报警器真红时 issue 与微信都该发出去 · `deepseek-v4-pro` 少一格的状态。

---

## 该读哪份文档

| 文件 | 什么时候读 |
|---|---|
| `AGENTS.md` | **动手之前必读**。操作合同、九项检查、已经踩过的坑 |
| `docs/ARCHITECTURE.md` | 架构、数据政策、§9 采集现状与每个源的判定、§10 已知限制与下一步 |
| `docs/AGENT-OPERATIONS.md` | 排程 agent 的章程：三个风险层级、硬规则、alias 归属规则 |
| `docs/UI.md` | 改任何界面之前：字号地板、断点、手机契约 |
| `docs/INGEST-PROMPT.md` | 要让一个浏览模型抄一批数据时的转录合同 |
| `GOTCHAS.md` | **动手之前扫一遍**：**31** 条仍会咬人的坑，编号稳定可引用（复算 = `grep -c '^### ' GOTCHAS.md`）。⭐ 动 DeepSeek 任何东西之前读 **24**（preview→GA 串号，判据 + 动手顺序）与 **25/26**（"preview"在名字里≠是个 preview；引用别人写的格数前先自己数）。⭐ 动**价格或参数批次**之前读 **27**。⭐ 动 **workflow / 通知 / 脚本封顶**之前读 **29**（报警器在正比于它要报的规模上失灵,而失灵的样子是绿色）;动 **git stage** 之前读 **30**;动**图标**之前读 **31**。⭐ 族：第五族 15–18「我以为我知道数据长什么样」、第六族 21–23「审计的取数口径本身就是盲区」、19 = 报告里干净≠网站上干净 |
| `TODO.md` / `LOG.md` | 接下来做什么 / 以前为什么这么做。⚠ LOG 轮转过多次（现存档见 `ls LOG-archive/`）——检索一律 `grep LOG.md LOG-archive/*.md` 两边一起搜 |

Git 状态一律现查（`git log --oneline -5`、`git status`），这里不记 HEAD、不记分支进度。
