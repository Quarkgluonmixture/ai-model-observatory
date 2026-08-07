# TODO

**只放未来。做完的条目立刻删掉**——历史在 `LOG.md` 里，不在这。

结构性的「已知限制」不写在这里：那是 `docs/ARCHITECTURE.md` §10 的职责，那份是唯一真相。
这里只放**可以动手做完、做完就能删掉**的事。

---

## 等人拍板

- [ ] `auto/attribution` 里那 8 条 alias：接上 Claude Opus 4.8 和 GPT-5.5 的效率档行之后，
      `arc-agi-2` 那两格的主行会换（72.08→62.22、85→83.33）。**要不要换是编辑判断**——
      效率档行更精确，但会改动两个已发布的数字。

## 继续把手抄批次变成脚本源

22 个批次里 9 个可脚本重读，13 个是手抄的、只有"上次有人读它是什么时候"这一个新鲜度信号。
按 §10 的规矩：**动手前先重新探一遍**，那份"没有路"的名单已经被推翻六次了。

候选（按对覆盖率的价值排）：

- [ ] Vals AI 子基准
- [ ] OSWorld 2.0 / Toolathlon / MCP-Atlas（agent 轴，目前全靠手抄）
- [ ] FrontierSWE / ProgramBench（后者官方分与厂商表差 70 分，注意别混指标）
- [ ] APEX-Agents
- [ ] ARC Prize verified board（公开 eval 那份是**另一个切分**，高 ~11 分，别替换）

## 小口子

- [ ] 三个无源值找出处：`qwen3.8-max open`、`qwen3.7-plus contextK`、`qwen3.7-plus open`。
- [ ] 观察一周：LMArena 每天都动，会不会天天产生自动提交。太吵就放宽取整阈值。

## 自动化

2026-08-07 一天做完两轮，见 `LOG.md` 同日五条。**剩下的只有需要观察的，没有待做的**：

- [ ] 明早（2026-08-08）验一次：`auto/refresh-aa` 的 PR 应该自己开出来；gaps issue 末尾应该多一节
      「Is the queue being worked?」；`auto/attribution` 应该**跳过**（PR #45 还开着，`--any-open`
      会让它按兵不动并写 warning）。
- [ ] ⚠ **PR #45 一天不处理，alias 管线就一天不流**。这是 `--any-open` 有意的代价（卡住看得见、
      被改写看不见），但别忘了它卡的不只是自己。
