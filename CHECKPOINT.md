# CHECKPOINT

**接手点** — ARC 三个 split 全部脚本化并接上目录，等人合 `feat/arc-attribution`（**不能自合**，
见下）。之后继续把手抄批次变成脚本源。

Snapshot for the next session. One page. Durable reasoning lives in the docs below; history lives
in `LOG.md`; future work lives in `TODO.md`. Nothing here is a substitute for `AGENTS.md`, which is
the operating contract and still comes first before any change.

---

## 现状（2026-08-07）

| | |
|---|---|
| 目录 | 29 model families · **70** benchmarks（新增 ARC-AGI-1 `legacy` · ARC-AGI-3 `observe`） |
| 观测 | **1391 rows · 980 / 2030 cells（48.3% cell coverage）** |
| 源分类 | benchmark 880 / independent 321 / vendor 190 |
| 溯源 | 318 / 321 catalog values backed by the archive |
| 归档 | **25 batches，其中 12 个可脚本重读**（其余 13 个是手抄，永不自更新） |
| 站点 | `/` 个人站 · `/models` 观测台，同一个仓库，EdgeOne Pages |

覆盖率从 48.6% 读到 48.3% 是**分母变大**：两个新列进了 58 格网格，证据进了 22 格。三个数字一起读。

三个无源值（`check:models` 每次都会报，属于诚实的空缺而非错误）：`qwen3.8-max open`、
`qwen3.7-plus contextK`、`qwen3.7-plus open`。

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

改了 `app/globals.css` 或 `app/models/page.tsx` 才需要 `npm run check:mobile`
（要 Chrome + `PORT=3111 npm run start:next`，**跑完必须停掉那个 server**——
`lsof -nP -iTCP:3111 -sTCP:LISTEN` 确认，别用 `pgrep -f "next start"`，它会匹配到自己那条命令）。

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

1. **等你拍板：`feat/arc-attribution`**（两个 commit）。ARC 收尾三个判断题全做完了：52 条 alias
   （37 条用数字对着 Epoch 逐位确认）、batch 01 的 95 条 ARC 行 supersede、新增 ARC-AGI-1 与
   ARC-AGI-3 两列。**它不能自合**，因为 `describe-change` 报 7 个已有数字被改动 —— 全是
   1 位小数手抄值换成全精度原值（72.1→72.08、90.4→90.42，最大 0.04）。三条件第 2 条按设计拦住了它，
   这正是闸门在工作。判断依据全部写进了 commit message、`data/model-aliases.json` 的 `_doc`
   和 `LOG.md` 2026-08-07 第四轮。
   ⚠ 合之前先 rebase：归属闸门每天也写 `data/model-aliases.json`，而它不会为这个分支让路。
2. **明早（2026-08-08）验一次改完的链路**：`auto/refresh-aa` 的 PR 应该**自己开出来**；gaps issue
   末尾应该多一节「Is the queue being worked?」；`auto/attribution` 应该**正常跑**（`auto/attribution`
   上没有 open PR）。详见 `TODO.md`。
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
