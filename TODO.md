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
