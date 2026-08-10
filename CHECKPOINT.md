# CHECKPOINT

**接手点** — 2026-08-10 八个 PR **全部合并并已发布**(#65–#72)：**站上线在
`https://quarkspace.top`**(ICP 页脚 +
`check:deployment` 首次真的在跑) · gaps 报告分三层并折叠 · 两个分类器自测进 CI ·
**batch 30 SWE-Bench Pro 脚本化** · 修掉一条让报告对 Gemini 3.5 Flash Lite 全盲的子串过滤 ·
**最后一个 PR:网站上那份「上游模型」从没拿到过滤器**,而那 5 条档位噪音正占着 8 个名额里的 5 个、
挤掉 3 个真模型 ⇒ 判定逻辑收进 `app/upstream-variants.ts`(唯一的家,三个调用方 import)。
下一步在 `TODO.md`，**全是要你定的**：CyberBench 两列 · 8 块板的轴与 core/observe ·
`vals-mmlu-pro` 那一个断言 · hermes 死了要不要推微信。等批复的只有公安备案(约 2026-09-09)。

Snapshot for the next session. One page. 现场状态在这里；**动手前的自查在 `GOTCHAS.md`**；
历史在 `LOG.md`；未来在 `TODO.md`。都不能替代 `AGENTS.md`——它是操作合同，改任何东西之前先读它。

---

## 现状（2026-08-10）

| | |
|---|---|
| 目录 | 29 model families · **72** benchmarks |
| 观测 | **2133 rows · 1382 / 2088 cells（66.2% cell coverage）** —— 8-10 实测 |
| 源分类 | benchmark 918 / independent 1025 / vendor 190 |
| 溯源 | **321 / 321**（100%，batch-27 于 2026-08-08 补齐最后三个） |
| 归档 | **30 batches，其中 16 个可脚本重读**（8-10 实测 `meta.collectedWith`；batch 30 = SWE-Bench Pro）；⚠ **「裸奔 1,287 行」这个数复现不出来**（两种测法得 1,404 / 1,226），引用前先钉定义 |
| 归档里收了不入库 | **3582 行**，全部带写明理由（`droppedBenchmarks` / 未映射 / 已退役）——拒绝也要可审计 |
| 站点 | **`https://quarkspace.top`**（+ `www`，两个都 200）· `/` 个人站 · `/models` 观测台，同一个仓库，EdgeOne Pages |

⚠ **三个数字一起读，别只读百分比**——加一个基准会同时放大分母。覆盖率这几天怎么走的，
见 `LOG.md` 2026-08-06 起各条。

**域名 / 备案已定案**（两个域名 × 两条路由的服务端 HTML 都渲染 ICP，`check:deployment` 绿）——
细节与三步绑定顺序 → `docs/ARCHITECTURE.md` §6。⏳ 只剩：公安联网备案约 2026-09-09 出结果，
批了在 `app/site-beian.tsx` 补第二个号链 `www.beian.gov.cn`（一个文件的事）。

**自动化真正剩下的**看 `TODO.md`（堆 1「只差你一个事实」8-10 已清空；剩下是下一个 chunk 与判断题）。
⭐ **「上游有、目录没有」不是缺陷清单**,而它**由两处独立算出** —— `report:gaps`(存档证据链,
只有过地板的才计入 issue 计数)和 `app/api/live-models/route.ts`(网站那份,运行时)。判定逻辑
现在只有一个家 `app/upstream-variants.ts`(route 里 import 必须带 `.ts`)。⚠⚠ **报告干净不等于
网站干净** → `GOTCHAS.md` 19 + `docs/ARCHITECTURE.md` §6「Two code paths…」。

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

1. **明早第一次看到分层后的 gaps issue**：上游那一节应当是**折叠的一行**,计数**不含**地板下的候选
   (8-10 本地实测 58)。若 7 个上游名字都算成 gap,就是 `clears` 没生效。**顺手在站上点开那个折叠**:
   应当 6 个名字、零 `(batch)`/`(Fast)`,且**要有** Luna Pro / Terra Pro / Sol Pro(被噪音挤掉过的三个)。
2. **`swe-pro` 第一次自己动**（batch 30 是 `live`）。Scale 加一个模型就该开 PR;
   ⚠ 它读的是 RSC flight，**不是稳定 API** —— 挂了应当是**大声 throw**(六条断言),
   不该是"看板变小了"。真挂了先看 `docs/ARCHITECTURE.md` §9 里 SWE-Bench Pro 那行。
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
| `GOTCHAS.md` | **动手之前扫一遍**：20 条仍会咬人的坑，编号稳定可引用。⭐ 8-10 新增第五族「我以为我知道数据长什么样」(15–18)——一天踩三次同形错；19 = 规则写在报告里≠网站在生效(同一句话两条代码路径)，20 = `<small>` 自己掉到 9px 底下 + 检查器不选中的元素永远通过 |
| `TODO.md` / `LOG.md` | 接下来做什么 / 以前为什么这么做。⚠ LOG 已第六轮轮转（8-10）——检索一律 `grep LOG.md LOG-archive/*.md` 两边一起搜 |

Git 状态一律现查（`git log --oneline -5`、`git status`），这里不记 HEAD、不记分支进度。
