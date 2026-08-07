# TODO

**只放未来。做完的条目立刻删掉**——历史在 `LOG.md` 里，不在这。

结构性的「已知限制」不写在这里：那是 `docs/ARCHITECTURE.md` §10 的职责，那份是唯一真相。
这里只放**可以动手做完、做完就能删掉**的事。

---

## 继续把手抄批次变成脚本源

25 个批次里 12 个可脚本重读，13 个是手抄的、只有"上次有人读它是什么时候"这一个新鲜度信号。
按 §10 的规矩：**动手前先重新探一遍**，那份"没有路"的名单已经被推翻七次了。

候选（按对覆盖率的价值排）：

- [ ] Vals AI 子基准
- [ ] OSWorld 2.0 / Toolathlon / MCP-Atlas（agent 轴，目前全靠手抄）
- [ ] FrontierSWE / ProgramBench（后者官方分与厂商表差 70 分，注意别混指标）
- [ ] APEX-Agents

ARC Prize 三个 split（batch 23/24/25）已全部脚本化并接上目录，见 `LOG.md` 2026-08-07 第四轮。
探测细节住在 `scripts/fetchers/arcprize.mjs` 的头注释里，不在这。

## 自动化剩下的缺口（2026-08-07 第六轮后，详情在 `docs/ARCHITECTURE.md` §10）

三个做掉了（手机探针进 CI · 空行第四条 · 线上站验证机制），缺口 2 按你的决定跳过。剩下：

- [ ] ⭐ **填 `data/deployment.json` 的 `productionUrl`** —— 只有你有这个事实。填之前
      `check:deployment` 每天在 gaps issue 里把自己报成「没跑」。填一行就激活：
      `"productionUrl": "https://<域名>"`。机制已经验过（读 JS chunk，不依赖 DOM 显不显示）。
- [ ] **hermes 死了没人被推送**（你说不用管，留在这里只作记录）。GitHub 挂 → hermes 推微信；
      hermes 挂 → 只写进它自己读的那个 issue。
- [ ] **91 格落在单源列上**（τ³-Banking 和 IFBench 按定义只有 AA 一家）。跨源分歧闸门在那些列上
      永远不会响 —— 结构性的，不是能修的，记在这里是防止有人误以为闸门覆盖了它们。
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

- [ ] 三个无源值找出处：`qwen3.8-max open`、`qwen3.7-plus contextK`、`qwen3.7-plus open`。
- [ ] 观察一周：LMArena 每天都动，会不会天天产生自动提交。太吵就放宽取整阈值。
- [ ] ARC 的两条「显示名说该映射、`modelGroup` 说不是」的字符串
      （`openai-gpt-5-5-2026-04-23-high`、`google-gemini-3-1-pro-preview`）现在按两个带日期的快照
      处理、不映射。**如果 ARC 之后把旧快照撤下、只剩一条**，那就该映射了 —— 值得偶尔回头看一眼，
      代价是 ARC-AGI-3 的两格（0.43 / 0.42）。判据和证据写在 `data/model-aliases.json` 的 `_doc`。

## 自动化

- [ ] 明早（2026-08-08）验三件事：① `auto/refresh-aa` 的 PR **自己开出来**（8-07 是
      `gh: Argument list too long` 开不出来）；② gaps issue 末尾多一节「Is the queue being worked?」；
      ③ `auto/attribution` **正常跑**——#45 已于 8-07 合并，没有 open PR 了，所以 `--any-open` 不该
      触发。要是它反而写了「Attribution paused」的 warning，就是那个判据反了。
      ⚠ 判据是 branch-scoped：`pr-hands-off.sh` 查 `gh pr list --head auto/attribution`，
      **只看那一个分支**，别的分支上有没有 open PR 它一概不管。
- [ ] 观察 `--any-open` 第一次真正生效是什么时候（下一个被三条件拦在 `auto/attribution` 上的 PR）。
      那天起**新 alias 提议会开始积压**，确认 warning 确实写进了 step summary、不是静默的。
