# CHECKPOINT

**接手点** — 2026-08-09 两轮脚本化都已合进 main：FrontierMath（batch 28，PR #61）与
Vals AI 全部 37 块板（batch 29）。覆盖率 52.4% → **64.6%**。下一步在 `TODO.md`：
还剩 1,287 行手抄裸奔，以及 16 块 Vals 板要不要开目录列（分类学判断，交给你）。

Snapshot for the next session. One page. Durable reasoning lives in the docs below; history lives
in `LOG.md`; future work lives in `TODO.md`. Nothing here is a substitute for `AGENTS.md`, which is
the operating contract and still comes first before any change.

---

## 现状（2026-08-09）

| | |
|---|---|
| 目录 | 29 model families · **72** benchmarks |
| 观测 | **2125 rows · 1374 / 2088 cells（65.8% cell coverage）** |
| 源分类 | benchmark 918 / independent 1017 / vendor 190 |
| 溯源 | **321 / 321**（100%，batch-27 于 2026-08-08 补齐最后三个） |
| 归档 | **29 batches，其中 15 个可脚本重读**（11,137 / 1,751 行 = 86.4%）；⚠ 别读这个比例——1,751 行里 464 行已 supersede，**真正裸奔的是 1,287 行** |
| 归档里收了不入库 | **3582 行**，全部带写明理由（`droppedBenchmarks` / 未映射 / 已退役）——拒绝也要可审计 |
| 站点 | `/` 个人站 · `/models` 观测台，同一个仓库，EdgeOne Pages |

覆盖率这几天走的四步：48.3%（ARC 两个新列，分母进 58 格证据进 22 格）→ 52.4%（AA 第二条 API
路径，+110 格）→ 53.7%（FrontierMath 脚本化，+25 格）→ 64.6%（Vals 全部 37 块板，+227 格）
→ **65.8%**（ProgramBench 与 Terminal-Bench 2.0 接上已有的列，+25 格）。三个数字一起读，别只读百分比。

**已在跑的自动化**（8-07 那批）：`check:mobile` 进 CI（两条路由，找不到 Chrome 直接失败）；
`describe-change` 的第四条合并条件 `new-models-below-floor`（空行三项契约全绿，只有它会说）；
`check:deployment` 建好但**等你填 `data/deployment.json` 的 `productionUrl`**；
`add-model-and-merge.sh` 在每日 job 里给「够格的上游新模型」自动建目录记录（四条条件）。

**8-09 修的两个静默失效**：
1. `fetch-source.mjs` 的 `cellKey` 不含 `benchmark_version`，于是 batch 28 的两个 tier 撞进
   同一个 key——86 行只核了 44 格。加上版本字段后 86/86，其余 11 个源逐源格数不变（对过当天 CI 日志）。
2. **单源卡死会吃掉一整天**：drift job 有 `timeout-minutes: 10`，浏览器 fetcher 偶发卡住时
   进程被杀在打印之前，那天一个源都没核。现在 `FETCH_TIMEOUT_MS` 逐源兜底（默认 300s，
   CI 两步设 120s）——卡住 = 报出来、置退出码、继续下一个。实测健康值：全量 12 源 36 秒。

**自动化真正剩下的**看 `TODO.md` 那一节（分三堆：只差你一个事实 / 下一个 chunk / 判断题）。
⚠ §10 里三个自报的数当天全部过期并已重测；「83.3% 自维护」**不能当进步读**，手抄行只从
1,749 动到 1,751，比例上升全靠脚本批变大。

---

## 自动化链路：谁在什么时候跑什么

| 时间（UTC） | 在哪 | 做什么 | 能不能自己合并 |
|---|---|---|---|
| ~08:10（cron 写 06:00，GitHub 实际延迟约两小时） | GitHub Actions `upstream.yml` | **12** 个脚本源漂移检查 → 重抓 live 板 → 发布页探针 → 写 gaps issue → AA 新模型侦测 | 只碰 `data/sources/` + 生成文件 → **直推 main** |
| 同上，末步 | GitHub Actions | 归属闸门 `attribute-and-merge.sh`：提议 alias → 跑契约 → 三条件满足才自合 | 有条件自合，否则留 PR |
| 09:30 | hermes（Windows 定时任务） | 读 gaps issue → 挑一件完整做完 → 开 PR / tier-B 三条件自合 | 有条件自合 |
| 任意 push 到 main | GitHub Actions `ci.yml` | 七项契约 + 归属闸门回测 + **站上新增模型才推微信** | — |

**三条件**（tier B 自合的唯一门槛，写在 `docs/AGENT-OPERATIONS.md`）：契约全绿（含跨源分歧闸门与
一源两串闸门）· `describe-change` 报告**没有已有数字被改动** · 没有写 `acknowledgedDisagreements`
或 `mergedInOneSource` 例外。

⚠ 闸门的「有人在看就别动」判据是 **branch-scoped**：`pr-hands-off.sh` 查
`gh pr list --head auto/attribution`，别的分支上有 open PR 它不管。

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
```

`npm run check:mobile` **2026-08-07 起进了 CI**（两条路由都探，用 runner 自带的 Chrome，
找不到 Chrome 直接失败而不是跳过）。本地改布局时照样跑，要 Chrome + `PORT=3111 npm run start:next`，
**跑完必须停掉那个 server**——用 `lsof -nP -iTCP:3111 -sTCP:LISTEN` 确认，
别用 `pgrep -f "next start"`，它会匹配到自己那条命令。

其他常用：

```bash
npm run propose:attribution            # 归属闸门今天能定多少
npm run propose:attribution -- --backtest   # 回测 300 条人工判断（CI 里也跑）
npm run describe-change origin/main    # 这次改动对已发布看板做了什么
npm run report:gaps                    # 什么从来没被采集过
npm run check:upstream                 # 12 个脚本源逐格对照
node scripts/fetch-source.mjs arcprize # 单独重抓一个源（arcprize / arcprize-v1 / arcprize-v3）
```

**推送前**：`gh auth switch -u Quarkgluonmixture`（个人账号）。仓库密钥：`AA_API_KEY`、
`PUSHPLUS_TOKEN`，两个都是可选的——缺了对应步骤跳过自己，不会让任何检查变红。

**微信推送**（2026-08-07 从 4 条补到 7 条，补的三条全是「本来坏了也没人知道」）：

| 何时 | 在哪 |
|---|---|
| 站上新增模型 | `ci.yml` |
| 归档完整性失败 / 恢复 | `upstream.yml` |
| AA 刷新但 PR 没开成 | `open-aa-pr.sh` |
| **AA 刷新整体失败**（挂在开 PR 之前的任何一步） | `aa-refresh.yml` |
| **main 检查变红**——EdgeOne 合并即发布不看 CI，所以这是「站已经上线且契约在失败」 | `ci.yml` |
| **GitHub 每日 job 超 36h 没跑完** | hermes（`npm run check:heartbeat -- --github`） |

「只在异常时说话」的策略没变，补的是这条通道**够不着的那几个异常**。
砍掉的六条为什么砍，在 `docs/ARCHITECTURE.md` §10。

**沉默现在可诊断**：两个调度器互相看守，只用已有产物。hermes 每轮开头查 GitHub（36h 阈值，
推微信）；每日 job 查 main 上最近的非 bot 提交（3 天阈值，只写进 gaps issue、不推微信）。
阈值为什么是 36h / 3 天，写在 `scripts/check-heartbeat.mjs` 头部。

---

## 现在要盯的三件事

1. **batch 29 改动了 51 个已发布数字**，其中两个不是精度、是**证据等级**变了：
   Qwen3.8 Max · Terminal-Bench 86.6（厂商）→ 67.416（Vals，独立），
   Gemini 3.1 Pro Preview · MMMU-Pro 80.5 → 88.208。第 3 条在起作用（独立压厂商），
   但这是站上肉眼可见的移动，值得你亲自看一眼。理由写在 `acknowledgedDisagreements`
   与 `LOG.md` 2026-08-09 第三轮。
2. **两个「悬案/没有路」都结了**：Epoch zip 里的 FrontierMath 是**退役题集**（2025-02-28 /
   2025-07-01），不是坏掉的导出；Vals **不是没有机器可读路径**——它的板是 Astro，整块榜单就在
   HTML 的 `props="…"` 属性里（读法在 `scripts/lib/astro-props.mjs`）。
   ⭐ **null 不是中立值**（今天撞了两次）：在有 `versionFallbacks` 的列上它是「继承」，在没有的列上
   它是「丢弃」—— 一律填 null 曾悄悄删掉 50 行 Terminal-Bench；而 `program` 列看着是空的，其实是
   归档里 15 行 benchmark-native 全被丢掉了。
   ⭐ **「这一列是空的」要查归档，不要查 `observations.generated.ts`** —— 生成产物是空的，
   可能正因为有东西在 ingest 被丢掉。
3. **LMArena 每天都会动**，所以大概率每天产生一次 tier-A 自动提交（静默，不推微信）。观察一周，
   太吵就把取整阈值放宽。

---

## 该读哪份文档

| 文件 | 什么时候读 |
|---|---|
| `AGENTS.md` | **动手之前必读**。操作合同、七项检查、已经踩过的坑 |
| `docs/ARCHITECTURE.md` | 架构、数据政策、§9 采集现状与每个源的判定、§10 已知限制与下一步 |
| `docs/AGENT-OPERATIONS.md` | 排程 agent 的章程：三个风险层级、硬规则、alias 归属规则 |
| `docs/UI.md` | 改任何界面之前：字号地板、断点、手机契约 |
| `docs/INGEST-PROMPT.md` | 要让一个浏览模型抄一批数据时的转录合同 |
| `TODO.md` / `LOG.md` | 接下来做什么 / 以前为什么这么做 |

⚠ 生成文件 `app/observations.generated.ts` 现在按 300 行分块发出，不是一个大数组 —— 那是
TypeScript 的并集上限（约 1,120 行就炸 `npm run build`），原委在 `scripts/ingest.mjs` 头注释
和 `docs/ARCHITECTURE.md` §10。别把它合回一个数组。

Git 状态一律现查（`git log --oneline -5`、`git status`），这里不记 HEAD、不记分支进度。
