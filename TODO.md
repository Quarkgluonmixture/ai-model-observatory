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

## 自动化的四个缺口（2026-08-07 实测，详情在 `docs/ARCHITECTURE.md` §10）

按「便宜 × 挡住的东西」排：

- [ ] **`check:mobile` 进 CI**。现在 CI 跑 lint / ingest-diff / check:data / check:models /
      check:prices / 回测 / build，**没有 mobile** —— 手机端回归只在有人记得跑的时候才被抓到，
      而 `/models` 的表刚多了两列。需要 headless Chrome + 起 server 两步。
- [ ] **hermes 心跳也推微信**。现在 GitHub 挂了 hermes 会推微信，hermes 挂了只写进 gaps issue ——
      而那个 issue 主要是 hermes 自己读。一行的事：把 `check-heartbeat --agent` 的非零退出接上
      `scripts/notify-pushplus.mjs`。⚠ 但先想清楚判据：`--agent` 按设计分不出 hermes 和你
      （代码注释里写明了），所以你自己推一次就会重置那个 3 天时钟。
- [ ] **线上站没有任何验证**。EdgeOne 合并即发布不看 CI，现有那条微信量的是 main 变红、不是部署
      成没成。最小可做：每日 job 拉一次线上 `/models`，比对页脚或某个已知数字和 main 一致。
- [ ] **三条件不防空行**（实测：零证据记录下 check:data / check:models / check:prices 全绿，
      `check:models` exit=0）。真正拦住它的是 `describe-change` 把「新增目录记录」计进 `moved`，
      属于侥幸。要建新模型自动化就得补第四条：**有证据才允许建记录**。
      ⚠ 实现约束：`check:models` 对「alias 指向不存在的目录 id」exit=1，所以记录必须先于 alias，
      「已解析的行数」对新模型恒为 0 —— 证据只能数**归一化后能对上的未映射字符串**。

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
