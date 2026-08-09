# GOTCHAS

**动手之前扫一遍。** 这里不是编年史（那是 `LOG.md`），也不是现场状态（那是 `CHECKPOINT.md`）——
是**现在仍然会咬人**的东西。

三条纪律：**编号只追加、永不重排**（别处按号引用）；**同一个坑踩第二次就在原条目上记复发计数**
（这是把偶发和机制分开的唯一判据）；**能被命令模式识别的坑应该变成 hook 或断言，不要停在文档里**。

拆出来的时间：2026-08-09，因为快照被坑类条目顶过硬上限，且坑 1 当天踩了两次。

---

## 一族：把「没有值」当成「中立值」

四条同形。共同机制：**一个缺失的字段在不同的下游有不同的默认语义**，而写入方只想着"我没有这个信息"。

### 1. `null` 不是中立值 —— 有 fallback 的列上是「继承」，没有的列上是「丢弃」
**已踩两次（2026-08-09 同一天）。**
- 症状：契约七项全绿，但看板上整整一列没有数据；归档里明明有。
- 机制：`ingest` 对「既无 `benchmark_version`、又无 `versionFallbacks` 条目」的行**直接丢弃**，
  不是套默认值。所以同一个 `null`，在 `gpqa` 上是"继承 Diamond"，在 `terminal` 上是"删掉"。
- 两次实例：给 Vals 共享列一律填 null → **悄悄删掉 50 行 Terminal-Bench**；
  `program` 列看着是空的 → 其实归档里 15 行 benchmark-native 全被同一条路径丢掉。
- ⇒ **写 null 之前先查目标列有没有 `versionFallbacks`。** 共享列用显式表，不要用"统一置空"这种规则。

### 2. 「这一列是空的」要查**归档**，不要查 `observations.generated.ts`
**与坑 1 同形。** 2026-08-09。
- 症状：查生成产物得到 0 行，据此写下"这一列没有任何来源，不会混淆"——然后基于这句话做了决定。
- 机制：生成产物是 ingest 的**输出**。它是空的，可能恰恰因为**有东西在 ingest 被丢掉了**。
  拿输出去证明输入不存在，是循环。
- ⇒ 判断"某列/某源有没有数据"一律 `grep data/sources/*.jsonl`，生成产物只用来回答"**最终发布了什么**"。

### 3. 检查的 key 少一个维度 = 检查静默缩水，而它照常报绿
2026-08-09。
- 症状：`fetch-source.mjs --check` 报"86 rows, 44 cells verified"——数字对不上但没人会去对。
- 机制：`cellKey` 不含 `benchmark_version`，而 batch 28 是第一个在**一个批次里装两个 benchmark 版本**
  的批次，两个 tier 撞进同一个 key，Map 后写覆盖先写。每个模型的 Tier 4 分数退出了自己的漂移检查。
- ⇒ 新批次引入一个**以前没有过的维度**时，回头看一眼所有按 key 去重的地方。
  ⭐ 顺手看"**核了多少格**"和"**写了多少行**"对不对得上——这是唯一会说话的信号。

### 4. 单源卡死会吃掉一整天，而且**不留任何输出**
2026-08-09。
- 症状：Actions 上 drift job 红了，日志里什么都没有。
- 机制：job 有 `timeout-minutes: 10`，浏览器 fetcher 偶发卡住（实测同一条命令同一小时内：
  36 秒 / 9 分钟 / >80 分钟）时进程被**杀在打印之前**——那天不但没有源被核对，
  那一步自己的 `could not be read` 报告也没跑成。
- ⇒ 已由 `FETCH_TIMEOUT_MS` 逐源兜底（默认 300s，CI 两步 120s）。
  **推广**：任何"一个失败不能拖垮其他"的保证，都要问一句「**永不返回**算不算失败」。

---

## 二族：同名不同物 / 同物不同版

### 5. 官方发布的文件 ≠ 页面渲染的那一份
2026-08-09（Epoch FrontierMath）。
- 症状：Epoch 自己的 zip 里有 `frontiermath.csv`，读进来比榜单页低约 1.7 倍，找不到原因。
- 机制：zip 里那两个文件是**退役题集**（2025-02-28 / 2025-07-01），站上渲染的是 v2。
  同一个发布方、同一个基准、两个版本，**文件名不说是哪个**。
- ⇒ 找到数据文件不算完，**还要确认它就是页面渲染的那一份**（跟着 chunk 的 `fetch(` 走，
  或对着页面已知的几个数逐位核）。

### 6. 三个字母相同就以为是同一个基准
- 症状：`ale_bench_external.csv`（AtCoder heuristic rating ~2176）差点进 Agents' Last Exam 的列。
- 机制：名字是最弱的证据，而它最容易拿到。
- ⇒ 用**定义**核，不用名字核。反例（2026-08-09 通过的检查）：Vals 的 ProgramBench 与
  `facebookresearch/programbench` 的 GitHub 描述是**同一句话**，这才够格。
- ⭐ 同族陷阱：一块板的**多个 task 视图**也是不同的东西——ProgramBench 的
  `partial`(Raw Pass Rate) 给 GPT-5.5 是 70.775，`strict`(Fully Resolved) 是 0.5。
  差 140 倍，同一块板同一个模型。选错视图和选错基准一样致命。

### 7. 官方文件可能是**另一个 split**
- 机制：ARC 的 public eval 比 verified 板高约 11 分，基准名一模一样。
- ⇒ 每个 fetcher 钉死一个 `*_Semi_Private` split；换 split 前先对已知模型逐位核。

---

## 三族：工具本身在骗你

### 8. `grep` 的 `.` 是通配符 —— 数值 claim 的假阳性来源
2026-08-09。
- 症状：`grep -c "89.1" page.html` 返回 5，据此断定"分数是服务端渲染进 HTML 的"。全错。
- 机制：`.` 匹配任意字符，`8901` / `89-1` 全算命中。Python 精确匹配复查是 **0**。
- ⇒ 数字用 `grep -F` 或精确匹配复核。**任何 char/token/size/count 的结论下之前实测一次**。

### 9. 爬不到先怀疑自己的爬法
2026-08-09（Vals）。
- 机制：两个 bug 叠在一起——Astro 的 import 是**相对路径** `./x.js`（只认 `/_astro/` 的正则抓不到），
  以及站点**挡 `python-urllib`** 而 curl 通。
- ⇒ "这个源没有机器可读路径"是**关于你这次搜索**的结论，不是关于源的。
  这个仓库的该类判决已经被推翻 **8 次**。

### 10. 数据可能根本不在"数据文件"里，而在 HTML 属性里
2026-08-09（Vals）。
- 机制：Astro 把组件 props **服务端渲染进 `props="…"` 属性**。整块榜单就在 HTML 里，
  以 HTML 转义的 JSON 形式存在——所以查 `<table>` / `<tr>` / `fetch(` / `/api/` **全部答"没有"**。
  读法在 `scripts/lib/astro-props.mjs`（含 Astro 的 `[type, payload]` 值包装——不 unwrap
  就取字段，下面每一个都静默返回 `undefined`）。
- ⇒ 见到 `<astro-island>` 就去看 `props=`。Epoch 的基准页是同一套框架。

### 11. `pgrep -f "<X>"` 会匹配到你自己那条命令
- 机制：monitor 自己的 `bash -c` 串里就含 `<X>`，`grep -v grep` 救不了。
- ⇒ 查端口用 `lsof -nP -iTCP:3111 -sTCP:LISTEN`。
  ⭐ 相关：`check:mobile` 用完**必须停掉那个 server**——2026-08-01 有一个跑了四天，
  在另一台机器上表现为 `npm ci` 失败（包在盘上、`.bin` shim 从没链上）。

---

## 四族：闸门与发布的边界

### 12. EdgeOne **合并即发布，不看 CI**
- ⇒ `main` 绿不代表站上是对的，反过来更要紧：**合进去就上线了**。
  想回滚就 revert 那个 merge commit。个人站 `/` 的类型错误会挡住每日数据刷新（耦合是双向的）。

### 13. 「有人在看就别动」的判据是 **branch-scoped**
- 机制：`pr-hands-off.sh` 查的是 `gh pr list --head auto/attribution`，**只看那一个分支**；
  别的分支上有 open PR 它一概不管。
- ⇒ 别指望它替你发现"另一个 session 正在开 PR"。

### 14. 生成文件按 300 行分块发出，别合回一个数组
2026-08-07。
- 机制：`ObservationRow` 有四个可选属性，TypeScript 要对整个数组建并集；约 1,120 行就炸
  `npm run build`，报 *union type too complex*，指向生成文件第 6 行——**读起来像文件损坏，其实是长大了**。
- ⇒ 原委在 `scripts/ingest.mjs` 头注释与 `docs/ARCHITECTURE.md` §10。
