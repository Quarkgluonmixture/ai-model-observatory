# TODO

**只放未来。做完的条目立刻删掉**——历史在 `LOG.md` 里，不在这。

结构性的「已知限制」不写在这里：那是 `docs/ARCHITECTURE.md` §10 的职责，那份是唯一真相。
这里只放**可以动手做完、做完就能删掉**的事。

---

## 继续把手抄批次变成脚本源

22 个批次里 9 个可脚本重读，13 个是手抄的、只有"上次有人读它是什么时候"这一个新鲜度信号。
按 §10 的规矩：**动手前先重新探一遍**，那份"没有路"的名单已经被推翻六次了。

候选（按对覆盖率的价值排）：

- [ ] Vals AI 子基准
- [ ] OSWorld 2.0 / Toolathlon / MCP-Atlas（agent 轴，目前全靠手抄）
- [ ] FrontierSWE / ProgramBench（后者官方分与厂商表差 70 分，注意别混指标）
- [ ] APEX-Agents
- [x] ~~ARC Prize verified board~~ —— **fetcher 已落地（2026-08-07，batch 23，198 行）**。剩下的三件
      都是判断题，见下面「ARC 收尾：三个判断题」。以下探测记录保留，因为写 alias 时还要用：

      `https://arcprize.org/media/data/evaluations.json` · 200 · 152,870 bytes · **808 行**。
      页面是 Next.js 客户端渲染，路径不在 `_next` chunk 里，而在 `/scripts/leaderboard/data.js`
      的四个 `d3.json()` 里（另三个：`models.json` 99KB、`datasets.json`、`providers.json`）。
      记录形状：`{datasetId, modelId, score(0–1), costPerTask, resultsUrl, display}`。

      ⭐ **它是第一手源，而且比我们现有两份都好。** 按 AGENTS.md 的规矩拿已有模型对过：
      `anthropic-opus-4-8-{low,medium,high}` = 62.22 / 71.67 / 72.08，
      `gpt-5-5-2026-04-22-thinking-{low,medium,high,xhigh}` = 33.33 / 70.42 / 83.33 / 85.00,
      `gpt-5-5-pro-2026-04-23-{high,xhigh}` = 84.58 / 84.16 —— **和归档里 Epoch 镜像逐格一致**。
      也就是说 batch-12 那批 `independent` 行是这个文件的转录，而 batch-01 是同一批数据被人手抄成
      1 位小数。脚本化之后：`source_kind: benchmark`（正确压过镜像）· 全精度 · 重跑即漂移检查。

      ⚠ 四个必须先处理的陷阱：
      1. **同一个文件里混着三个切分**：`v2_Semi_Private` 才是 verified 板，`v2_Public_Eval` 就是
         陷阱 3 那个高 ~11 分的切分。站点自己只取 `*_Semi_Private`，fetcher 必须照做。
      2. **`v3_Semi_Private` 已经存在**（`datasets.json` 里 v1=ARC-AGI-1、v2=ARC-AGI-2）。
         那是**另一个 benchmark**，要自己的 benchmark id，绝不能并进 `arc-agi-2`（铁律 4）。
         顺带 v1 也能填 ARC-AGI-1，如果决定收的话。
      3. **档位在 modelId 后缀里**（`-low/-medium/-high/-xhigh`），不是独立字段 —— 这是**第七种
         拼写约定**，要新 alias。
      4. ⚠ **`gpt-5-5-pro-*` 不是 `gpt-5.5`**（Pro 是另一个模型，alias 文件 `_doc` 里记过）。
         `display: false` 的行要不要收也得定。

## ARC 收尾：三个判断题（batch 23 已落地，这三件是它剩下的判断部分）

fetcher 只做了判断无关的一半：证据落地、站上零变动（198 行里只有 2 行有 alias，`describe-change`
报「没有任何已有模型的数字被改动」）。剩下的：

- [ ] **写 alias，把那 ~196 行接上目录。** 这是**第七种拼写约定**（`anthropic-opus-4-8-high`、
      `gpt-5-5-2026-04-22-thinking-xhigh`）。⭐ **这里有个便宜的佐证工具**：这份文件的分数和归档里
      Epoch 镜像（batch 12）**逐格一致**，所以任何 ARC id 只要在同一格上和已归属的 Epoch 行对上数，
      身份就被**数字**确认了 —— 正是 `AGENT-OPERATIONS.md`「用数字而不是字符串确认身份」那条规矩
      （ALE 的 Qwen 双写法就是这么定的）。
      ⚠ 陷阱：`gpt-5-5-pro-*` **不是** `gpt-5.5`；`-1k/-8k/-16k/-32k/-64k` 是思考 token 预算不是
      effort；`-openrouter/-together/-bedrock` 是服务路由；`ARChitects`/`Icecuber`/`2025_human_panel`
      /`jeremy_sept_2025` 这些**不是模型**，按铁律 8 该一直留着不映射。
- [ ] **batch 01 的 ARC 行该不该 supersede。** 它是同一份文件被人手抄成 1 位小数的版本
      （72.1 vs 72.08）。先例是 batch 02 的 18 行 DeepSWE 眼读被 artifact superseded。
      ⚠ 现状：batch 01 的行**带 evaluationDate 而 batch 23 不带**，所以主行规则仍然偏向那个手抄的
      整数版。不 supersede 的话，全精度行会一直等着。
- [ ] **要不要收 `v1_Semi_Private`（ARC-AGI-1）和 `v3_Semi_Private`。** 两个都在同一份文件里、
      现在就能抓，但各需要一个**新的 benchmark id** —— 那是 taxonomy 决定。fetcher 的 `fetch(target)`
      已经接受 split 参数，加起来只是注册和 benchmark 定义。

## 小口子

- [ ] 三个无源值找出处：`qwen3.8-max open`、`qwen3.7-plus contextK`、`qwen3.7-plus open`。
- [ ] 观察一周：LMArena 每天都动，会不会天天产生自动提交。太吵就放宽取整阈值。

## 自动化

2026-08-07 一天做完两轮，见 `LOG.md` 同日五条。**剩下的只有需要观察的，没有待做的**：

- [ ] 明早（2026-08-08）验三件事：① `auto/refresh-aa` 的 PR **自己开出来**（8-07 是
      `gh: Argument list too long` 开不出来）；② gaps issue 末尾多一节「Is the queue being worked?」；
      ③ `auto/attribution` **正常跑**——#45 已于 8-07 合并，没有 open PR 了，所以 `--any-open` 不该
      触发。要是它反而写了「Attribution paused」的 warning，就是那个判据反了。
- [ ] 观察 `--any-open` 第一次真正生效是什么时候（下一个被三条件拦下的 PR）。那天起
      **新 alias 提议会开始积压**，确认 warning 确实写进了 step summary、不是静默的。
