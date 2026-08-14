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

### 24. DeepSeek 的 preview→GA 是**同一个字符串换了模型**，Pro 正在重演 Flash 那一次
2026-08-12 建立，**这次是事前**（Flash 那次是事后才发现的，见 `AGENTS.md`「One published model
string can mean two different models」）。编号接在末尾是因为编号只追加，家族仍是二族。

- **事实**：DeepSeek V4 Pro 的 GA 版 `DeepSeek-V4-Pro-0813` 于 2026-08-12 上线
  （OpenRouter `deepseek/deepseek-v4-pro-0813`，`created` 15:42:44Z，描述原文
  "This is the GA release of DeepSeek V4 Pro"）。旧的 `deepseek/deepseek-v4-pro` 仍在服务，
  `created` 停在 2026-04-24 —— **那是 preview**。
- **目录现在装的是 preview**：`deepseek-v4-pro` 的 11 格全部来自 2026-04-26 的 V4 model card。
  对得上厂商自己的 `DeepSeek-V4-Pro-Preview` 列（`hle-no-tools` 37.7 两边逐位相同）。
- **量级**：厂商 GA 表里同族两列差得离谱 —— DeepSWE **12.8 → 62.7**、Terminal 2.1 **72.1 → 87.9**、
  AutomationBench **12.8 → 31.8**、Cybergym **52.7 → 83.3**。串一格就是 Flash 那次
  「49.25 印成 100」的同一种事故，只是这次能提前拦。
- ⚠ **闸门未必救得了**：跨源分歧 >20% 只在**同一格已有另一个源**时才响。GA 的分若落在
  `deepseek-v4-pro` 现在的**空格**上（十列里目录只有 4 列有 preview 的数），没有分歧可比，
  静默生效，看板上就是「preview 记录突然变强了」。
- ⚠ **危险的是 5 条全局通配**：`DeepSeek V4 Pro` / `DeepSeek-V4-Pro` / `deepseek-v4-pro` /
  `DeepSeek V4` / `deepseek-v4-pro-thinking` 现在都 `effort: "*"` 无条件指向这条记录。
  各源开始发 GA 分时，**不改 slug 的源**（AA 是确定的那个：Flash 那次它就没改）会让裸串原地换意思。
- ⇒ **判据，按可靠性排**：
  1. **数字**。preview 与 GA 差 2×–5×，比任何字符串都好认 —— 和 ARC 那 37 条「用分数确认归属」同一个手法。
  2. **源自己分不分列**。OpenRouter、LiveBench、Epoch、LMArena 印 `-0813`；分列的源里裸串**就是** preview。
  3. **日期**。源的 `evaluation_date` / 模型 `created` 在 2026-08-12 之前 ⇒ preview。
- ⇒ **动手顺序**（GA 分第一次出现时）：先照 Flash 的剧本 —— 裸串加 `file` scope 或
  `effort` 限定，GA 串写显式 alias；**别先改目录记录的显示名**，改名会让 11 格 preview 的分
  当场挂到 GA 名下，那正是要防的事。preview 的分怎么退役，走 `supersededRows`，逐格写理由。

**⚙ 守卫现状(2026-08-13 加;这条仍未退休)** —— 已自动化的与仍靠人的,分清楚:
- ✅ **自动拒收**:`data/model-aliases.json` 的 `modelWindows` 给 `deepseek-v4-pro` 挂了
  `validUntil: 2026-08-12`,**带日期**的行(含声明了 `retrievedDateIsMeasurement` 的参数批次)
  不再落进这条记录,而是报成 unmapped。`scripts/lib/archive.mjs --self-test` 九向断言。
- ✅ **自动不新增**:归属闸门第五条拒绝 —— 不再为「档案里有带日期兄弟串」的裸串自动写 alias。
- ⚠ **仍守不住**:**没有 `evaluation_date` 且批次未声明**的行照样进来(这些串下 73 行里 38 行
  无日期)。收窄靠给行补日期,不靠把比较写严 —— self-test 已把这个洞钉成断言。
- ⚠ **上面「5 条全局通配」过时**:实测 **10 条** alias 指向这条记录;「11 格」也是子集,
  整条记录 58 格 ⇒ 见 26。
- ❌ **完全靠人**:记录身份本身(这条变 GA、还是 preview 另立),以及 preview 的分怎么退役。
  ⇒ **守卫只是把「静默写错」换成「大声缺」,没有替你做决定。**

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

---

## 五族:我以为我知道数据长什么样(2026-08-10 一天踩三次)

同一天在同一个仓库踩了三次同形的错:**我对着自己脑子里的数据模型下结论,而不是对着数据**。
三次的代价都不是"跑不通",是**写下了一个自信的假结论并据此改文档**。

### 15. JSON 字段名要对着一行真实数据核 —— `.get()` 让"字段不存在"和"值为空"长得一样
2026-08-10。**这条排第一,因为它最便宜也最能骗人。**
- 症状:我断言 `batch-26-aa-evaluations` 里两套分数「没有任何字段能分开」,据此改写了一段
  **原本正确**的注释,并开了一条「必须重抓这个批次」的 TODO。全错。
- 机制:字段叫 **`reasoning_effort`**,我读的是 `r.get('effort')` —— Python 的 `.get` 对不存在的键
  **静默返回 `None`**,于是每一行都"看起来"字段为空。这与坑 1 同族:**缺席被当成了一个值**。
  实际上 `reasoning max` / `non-reasoning` 把两个模型分得清清楚楚,而且 alias **早就写好了**、
  6 格全在库里 —— 它的 reason 里甚至写着"Found by the evidence counter's self-test"。
- ⇒ **下「某字段全为空 / 某列没有数据」的结论前,先 `print` 一整行原始 JSON**。
  用 `KeyError` 会响的取法(`r['x']`)去核字段名,不要用静默的取法。

### 16. 别重写这个项目自己的判定逻辑 —— 手搓一遍必然和它不一致
2026-08-10。
- 症状:我要数"还在裸奔的手抄行",自己写了一遍 supersede 匹配,得 1,404;改用
  `archive.mjs` 的 `supersededBy` 得 1,226;而文档里写的是 1,287。三个数,没有一个能互证。
- 机制:`supersededBy` 会按 `benchmark` / `benchmarkVersion` / `modelRaw` / `field` 四个维度做
  通配匹配,手搓版漏了 `field` 那一维 ⇒ 差 178 行。
- ⇒ **判定逻辑一律 import**,不复制。**而且**:自己测出的数与文档里的数不一致时,
  **不要用第三个数去覆盖文档** —— 先把定义钉死,否则你只是在制造第四个互相矛盾的数字。

### 17. 子串匹配 = 假阴性,而假阴性没有任何东西会报警
2026-08-10。**这个仓库为同一个坑付过两次代价了。**
- 症状:`report:gaps` 对 `Gemini 3.5 Flash Lite` **完全看不见**。它有 42 行证据、33 格,
  是当时证据最好的上游候选。
- 机制:`item.id.includes(catalogId)` —— `google/gemini-3.5-flash-lite` **包含**
  `gemini-3.5-flash`(目录 id)⇒ 判成"目录已有"。
- ⚠ **第一次的代价记在 `AGENTS.md`**:`list.find(id => id.includes("gpt-5.6"))` 返回
  `gpt-5.6-luna-pro`,GPT-5.6 Sol 的价格卡渲染成 $0.10/$0.60 而不是 $5/$30。当时把
  `PROVIDER_LOOKUPS` 改成了精确匹配 —— **另一个文件里没改**。
- ⇒ 家族匹配一律用 `sameFamily()`(`scripts/lib/upstream-evidence.mjs`,导出且有 15 条自测):
  家族本身、或家族 + 一个 operating point,**别的都不算**(`Pro`/`Codex`/`Lite`/`-fast` 都是别的模型)。
- ⇒⇒ **推广**:修一类 bug 时,把**同类调用点一起找出来**;而且**假阴性比噪音危险** ——
  噪音你看得见,漏报你看不见,尤其在一个设计上 `never fails` 的报告里。

### 18. `norm` 不剥逗号 —— 而它不能改
2026-08-10(写自测时当场发现)。
- 机制:`norm` 剥 `[\s._\-()]` 但**不剥逗号**,所以 `"(Reasoning, Max Effort)"` 的余项是
  `reasoning,maxeffort`,那个逗号会挡住 effort 剥离 ⇒ 该行按名字匹配不上。
- **不要"修"它**:`norm` 必须与归属闸门的归一化**逐字一致**,放宽它会悄悄改变那个闸门与证据
  计数器对「哪些串是同一个串」的共识。这是 mean recovery 只有 ~70% 的来源之一(AA 的操作点带逗号),
  而这个数**本来就声明是下界**。已在 `--self-test` 里钉成断言,防止有人顺手放宽。

### 19. 规则**写在报告里** ≠ 网站上也在生效 —— 同一句话有两条代码路径
2026-08-10(owner 指出:"这个你不是折叠了吗")。
- 症状:`report:gaps` 那一节我当天已经分层 + 折叠 + 排掉服务档位了,**quarkspace.top 上照旧
  八条平铺**,其中五条是 `(batch)` / `(Fast)`。我以为改完了。
- 机制:「上游已在提供、目录还没有的模型」这句话由**两处**独立算出来 ——
  `scripts/report-gaps.mjs`(AA 存档证据链)和 `app/api/live-models/route.ts`(OpenRouter 运行时)。
  `tierOf` / `variantOf` 在前者写过、在 `aa-new-models.mjs` 又写了一遍,**读者看到的那一条从没拿到**。
- ⚠ **代价不只是难看**:那 5 条噪音占着 `.slice(0, 8)` 的 5 个名额,把 `GPT-5.6 Luna Pro` /
  `Terra Pro` / `Sol Pro` **挤出了列表** —— 三个真模型,因为噪音而看不见。**静默截断读起来
  就是"就这些了"**。
- ⇒ 判定逻辑现在只有一个家:`app/upstream-variants.ts`,route 与两个脚本都 import
  (route 里必须写 `.ts` 扩展名:脚本用 Node 直接跑 route.ts,app→app 的 import 没有打包器帮它猜)。
- ⇒⇒ **推广**:修一条「读者看到的东西」时,先问**这句话是谁打印的**,而且是**几个谁**;
  报告干净不等于产品干净。另:凡是 `slice(0, N)` 都要把被截掉的数量一起报出来。

### 20. `<small>` 是 80%,会自己掉到 9px 地板底下
2026-08-10。
- 机制:`.fresh-note` 是 9px 块,里面的 `<small>` 默认 80% ⇒ **7.2px**,`check:mobile` 立刻报。
- 顺带发现:`check-mobile.mjs` 的控件选择器原本是 `a,button,input,select,label`,**没有 `summary`**
  —— 我加的第一个折叠控件它量不到。已补进选择器,并用「把高度压到 10px 看它是否报出来」
  证明了探测真的在跑(`details.fresh-note > summary h=13`)。
- ⇒ 折叠起来看不见 ≠ 可以低于地板:**读者点开就读得到**,所以修字号,不加豁免。
- ⇒⇒ 引入一种**新的元素类型**时,顺手确认检查器认得它;检查器不认识的东西,永远"通过"。

## 六族:审计的**取数口径**本身就是盲区(2026-08-12)

### 21. 厂商的**产品档**和 AA 的**操作点**写在同一个后缀位置
2026-08-12(owner 裁决「go」后动手)。
- 症状:`qwen3.8-max` 是全目录唯一一条四格全 null 的记录,而 AA 明明有它。
- 机制:AA 把操作点缀在 slug 尾巴上(`claude-opus-5-xhigh`),两个 AA fetcher 都按这个约定切。
  Alibaba 的 `Max` **不是操作点,是产品**(和 Plus / Turbo 并列),但写在同一个位置 ⇒
  `qwen3-8-max` 被切成 model `qwen3-8` + effort `max`,而目录的族名**就是** `qwen3.8-max`、
  没有 effort 维度。两边都没写错自己的约定,是**对同一个 token 的含义不一致**。
- ⚠ **光加别名不管用**:别名只改 model id,不改行上的 `effort`,而审计按 `modelId|effort` 分桶
  —— 行落进 `|max` 桶,目录 configuration 在 `|null` 桶,依然对不上。而 `max` 在
  `claude-opus-5` / `gpt-5.6-sol` 上是**真 effort**,一刀切会错到别家头上。
  ⇒ 必须在**切之前、按厂商**判断:`scripts/lib/product-tiers.mjs`(闭合规则住这里,唯一一份)。
- ⚠⚠ **真正的坑不是这一格,是它为什么没被发现**:`check-model-provenance.mjs` 对
  `resolveModelId` 解析不到的行**直接 `continue`**。解析不到 ⇒ 不参与审计 ⇒
  「321/321 backed · 0 contradictions」为真,**而它的范围是解析得到的行**。
  `npm run ingest` 天天在报 `6 x qwen3-8 (max)`,混在 5000 多条「上一代、故意不映射」里,
  和噪音长得一模一样 —— **报了等于没报**。
- ⇒⇒ 判一个数有没有被守住,**grep 哪条检查真的够得到它**,别问「有没有这个检查」。

### 22. 参数四格是**先到先得**:早批次占了坑,后来的读数永远进不来
2026-08-12,和 21 同一次动手时量出来的,**比 21 影响面大得多**。
- 机制:`check-model-provenance.mjs` 建 `effortIndex` 时是
  `if (row[field] != null && perEffort[field] == null)` —— 每一格取**第一个**给出它的行,
  而档案按**文件名顺序**读。`batch-06/07/08`(手抄的 AA 读数)永远排在 `batch-14`(脚本读的 AA)前面。
- ⇒ 一个早批次冻住的值,**不管源后来漂多远都还是「backed」**。`qwen3.7-max` 的 cost 在
  1.28 上停了整整一个文件的寿命,而 AA 现在读的是 0.5413(**差 2.4 倍**),审计一路 100% 绿。
- ⚠ `supersededRows` 这个机制**早就有**,但**只在 price / Elo 那条路径上被调用过**;
  参数四格从来没查过它。已补上调用(2026-08-12)。
- ⚠ 别把它当 bug 一刀改成「取最新」:AA **持续重测** speed / latency,追每一次抖动不是目的,
  而「第一个给出它的行获胜」正是手抄批次能给尚无脚本源的字段兜底的原因。
  这是**编辑判断**,逐格写进 `supersededRows`。
- ⇒ 现在 `check:models` 尾部会**报**「早批次占坑且与最新读数差 >5%」的格子(报告,不失败)。
  **数量以那条输出为准,别在文档里抄一个会漂的数**。
- ⚠ **2026-08-12 当天就自我修正过一次**:首次打印 35 格,其中「`glm-5.2` intelligence 34 vs 52.6」
  被我当成最大的一条标度漂移写进了报告 —— **那是错的**,它是坑 23 的 effort 落错桶。
  修好 23 之后这一条从名单上消失了。⇒ **一个异常值大得不像同类,先怀疑它不是同类。**

### 23. AA 有 135 个模型把操作点**只写在显示名里**,不写进 slug
2026-08-12,修坑 21 的路上撞出来的,**比 21、22 都更能悄悄发布错数**。
- 机制:AA 的 slug 是 `glm-5-2`,显示名才是 `GLM-5.2 (max)`。
  `artificial-analysis.mjs`(batch 14)**只读 slug** ⇒ 这 135 行全部 effort 为空。
  而 effort 为空正是审计拿来对**目录 default configuration** 的那个桶
  ⇒ **max 档的分被当成 default 档的分**,一个字都不会报。
- 实例:batch-07 手抄时把 GLM-5.2 记成两行(裸行 34、`(max)` 51),batch-14 却把 52.6 那条
  记成 effort 空。于是「glm-5.2 的 intelligence 从 34 跳到 52.6」看起来像标度巨变,
  **其实是两个不同操作点被塞进同一个桶**。
- ⚠ `aa-evaluations.mjs`(batch 26)**早就修了这个**,它的头注释写着「134 个模型只在显示名里给操作点」
  —— 同一个坑,**两个 fetcher 只修了一个**,而且修的那个还在注释里说另一个"依赖同一个约定"。
  ⇒ **一个约定被两处实现时,注释说"两边一样"不等于两边一样;去读第二处的代码。**
- ⚠ AA 会写 `(Reasoning, Max Effort)` —— **mode + level 两个维度**,只取一个会把
  reasoning 与 non-reasoning 塞进同一格(`model-aliases.json` 的 `_doc` 记着这个事故)。
  所以档案里存的是复合值 `reasoning max`,而目录的 configuration 只写 `max`。
  审计现在认「bare level 对上**唯一一个** `<mode> <level>`」,**有两个就拒绝**,不猜。
- ⇒ 归档的 `note` 里保着 `AA 名称 …`,所以这 135 行不用 API key 也能重解回来
  (`scripts/backfill-aa-reparse.mjs` 规则 2)。**证据里留着原文,错的只是解析** —— 这是能补救的前提。

### 25. 「preview」在名字里 ≠ 这条记录是个 preview —— 按名字执行会删掉 59 格
2026-08-13。当时正要落实一条刚定的规矩「preview 不单独收记录」,动手前量了一下才没删错。
- 目录里名字带 Preview 的有**两条**:`qwen3.6-max`(Qwen3.6 Max Preview,**5 格**)和
  `gemini-3.1-pro`(Gemini 3.1 Pro Preview,**59 格,全目录第二满**)。
- 差别不在名字,在**有没有被 GA 取代**:Google 和 Alibaba 会把 Preview 当**在售版本**卖上几个月,
  它就是那个模型现在唯一能用的形态;而 DeepSeek 的 preview 已经被 `-0813` 取代了。
- ⇒ 判据是**上游有没有一个取代它的 GA**,不是显示名里有没有那个词。
  ⚠ 这条同时也是 24 的边界:24 的动手顺序只适用于「被取代」的那一类。
- ⇒ 更一般的:**规则用词面执行之前,先把命中集合列出来数一遍**。这条规矩从提出到差点删掉
  一条 59 格的记录,中间只隔了一次 `grep`。(同族:26 的 11 格 vs 58 格。)

### 26. 引用别处写下的格数之前先自己数 —— 24 里的「11 格」是子集不是全集
2026-08-13。`GOTCHAS.md` 24 和 `CHECKPOINT.md` 都写着「`deepseek-v4-pro` 的 11 格全部来自
2026-04-26 的 model card」,读起来像"这条记录有 11 格"。**实测 58 格。**
- 11 是**四月 model card 那部分**;另外约 47 格来自三方板(LiveBench / Vals / Epoch /
  FrontierSWE 等),评测日期 2026-06-09 到 2026-08-06。
- 这不影响 24 的结论 —— 那些三方读数全在 GA(8-12)**之前**,量的仍然是 preview 那个模型,
  所以「整条记录都是 preview 的测量」依然成立,而且比原话更强。
- ⇒ 但两句话的**用途**不同:24 想说的是"这些分的来源",容易被读成"这条记录的规模"。
  拿它去估计影响面(比如"删掉才 11 格,不疼")就会差 5 倍。
- ⇒ **别人写下的计数只在它自己那句话的语境里成立**;换个用途就重新数一遍
  (`OBSERVATIONS_BY_CELL[id]` 的 key 数)。

### 27. `retrievedDate` 只对「页面上的快照」等于测量日期,对「累积出来的测量」不等于
2026-08-13,给参数行补测量窗口时,**动手前量出来的**,不是事后修的。
- 参数行没有 `evaluation_date`,唯一能当测量时间的替身是批次的 `retrievedDate`。
- **一刀切会出事**:`batch-22-arena` 的 `retrievedDate` 恰好是 2026-08-12 —— DeepSeek GA 当天
  15:42 UTC 才上线,晚于那批里的任何一票;而 Arena Elo 是**几周投票累积**的。按 retrievedDate
  兜底会把它判进 GA 窗口外、删掉 `deepseek-v4-pro` 已发布的 **1458 text / 1445 code**,
  去防一件根本没发生的事。
- ⇒ 分两类:**点时快照**(定价页上的价、AA 页面上的参数)—— 读它的那天就是它的日期;
  **累积测量**(Elo、投票、长期榜)—— 读它的那天什么都不是。
- ⇒ 所以做成**批次自己声明** `retrievedDateIsMeasurement`,默认 false = 旧行为。
  `scripts/lib/archive.mjs --self-test` 里有一条专门断言 **batch-22-arena 不许声明**,
  防的就是后人"顺手统一一下"。
- ⇒ 一般化:**给一个字段找替身之前,先问这个字段量的是一个时刻还是一段时间。**

### 28. 管道之后的 `$?` 不是你以为的那个命令的 —— 又踩了一次
**2026-08-14 第三次,变形出现**:`node --test … ; echo $?` 得 exit=0,而 `grep -E '^# (pass|fail)'`
零匹配 —— 看起来"跑了但没有断言"。真相是默认 reporter 用 `ℹ pass 3` 而不是 `# pass 3`,
换 `--test-reporter=tap` 一看是 3 用例 3 过 0 败。**「零匹配的检查」和「没跑的检查」长得一样**,
而这次是我的 grep 模式错,不是测试没跑。⇒ 断言"它真的跑了"要看**用例数**,别靠一个 grep 模式。
2026-08-13。验"契约会不会在 8-16 变红"时跑 `node … | tail -5; echo $?`,两边都得 0,
差点据此说"两侧都通过"。`$?` 取的是 **`tail`** 的退出码。
- `upstream.yml` 里早写着这条(「pipefail is load-bearing, not hygiene」,并注明
  `4239916` 曾把一个红着的 `check:models` 直推 main)。**规则写在别处不等于当场想得起来。**
- ⇒ 要断言退出码,就**别接管道**:单跑 `cmd >/dev/null 2>&1; echo $?`,
  或 `set -o pipefail`,或 `${PIPESTATUS[0]}`。
- ⇒ 更稳的是**别用 shell 断言**:`scripts/check-scheduled-prices.test.mjs` 用子进程读 `status`,
  没有管道可以骗人。
- ⇒ 同族:这跟 5 族「我以为我知道数据长什么样」是一个病 —— **验证工具本身也要验证**。

### 29. 报警器会在**正比于它要报的事情的规模**上失灵,而失灵的样子是绿色
2026-08-14。日常 job 红了(Vals 新板读不出),完整性通知这一步跑了,**issue 没开、微信没推**,
而那一步在 Actions 里显示✅。人是十小时后翻 Actions 才发现的。
- 机制两层。里层:`publish-integrity-issue.sh` 里 `detail="$(sed -n '/…/,/^$/p' "$LOG" | head -40)"`
  —— `head` 拿够 40 行就关管道,`sed` 吃 SIGPIPE,`set -o pipefail` 把它变成赋值的非零状态,
  `set -e` 于是在开 issue 之前退出。**只在 sed 的输出超过管道缓冲区时触发**(实测 ~1KB 段落
  exit 0、~400KB exit 141)⇒ 小漂移一直正常报警,**漂移越大越必然静默**。
  外层:`upstream.yml` 用 `|| echo "::warning::…"` 吞掉非零 ⇒ 步骤变绿。
- ⇒ 命令替换里**不要让第二个进程去关第一个进程的管道**:封顶用 `awk 'NR<=40'` / `awk … {exit}`,
  别用 `| head -n`。同族:与坑 28 一个病(管道会骗你),只是这次骗的是 `set -e` 不是 `$?`。
- ⇒ **报警链路也要有 self-test**。这个仓库所有断言都是关于数据的,通知侧一条都没有,
  而通知失败的样子是绿色。`publish-integrity-issue.sh --self-test` 现在重放那天的日志形状,
  并用 dry-run(`gh`/推送换成 no-op)跑**完整条路径** —— 只走到 body 之前的 dry-run 抓不到这个 bug。
  已进 CI。验证过它有解释力:把旧管道放回去,五条断言里两条转红。
- ⚠ 仍未做的两件(留在 `TODO.md`):那两句 `|| echo "::warning::"` 仍把失败吞成绿色;
  `upstream.yml` 定性 integrity 用的是一句 `grep -q "no longer matches its archive"`,
  **分不出「值被改写」和「值新增」**,那天的 availability 失败因此走了 integrity 通道。

### 30. `git add` 撞到一个已被 `git rm` 的路径 ⇒ **整条命令失败、什么都没 stage**,而紧跟的 commit 照样成功
2026-08-14。`git add a b c public/favicon.png`(那个文件此前已 `git rm`)→
`fatal: pathspec 'public/favicon.png' 未匹配任何文件`。git add 对 pathspec 错误是**全或无**,
所以 a/b/c 一个都没进 index;而下一句 `git commit` 用**之前**残留的 staged 内容(两个删除)提交成功,
commit message 却描述着完整改动。**已经推上去之后才发现**(站上等于没有图标)。
- 机制:失败在 `git add`,成功在 `git commit`,两个命令之间没有任何东西对账。
  在 `&&` 串或多行 heredoc 脚本里尤其隐形——一条 fatal 滚过去了,后面照跑。
- ⇒ commit 前**必看** `git diff --cached --name-only`(全局规则本来就要求,这次是我跳了)。
  更硬的做法:`git add … && git diff --cached --name-only` 用 `&&` 串起来,让 add 的失败挡住后面。
- ⇒ 已经推出去了就 `--amend` + `--force-with-lease`,然后**核对 PR head 是否换成新 SHA**
  (`gh pr view N --json headRefOid` vs `git rev-parse HEAD`)——推送成功≠PR 看到了。

### 31. 生成模型交付的「SVG 图标」有三种坏法,都能通过肉眼验收
2026-08-14。同一个图标要了三轮,三种坏法各中一次:
- **位图套壳**:零个 `<path>`,只有一个 `<image href="data:image/png;base64,…">`。2.3MB,
  解出来的 PNG 与原始生图 **sha1 完全相同**。缩放不会变清晰,只是文件大 40 倍。
- **把画布外的黑边描进矢量**:第一句是 `<rect width="1254" height="1254" fill="#000"/>`
  —— 生图工具的画布底色被当成设计元素描下来了,四角会渲染成黑方块(实测 128px 四角 `(0,0,0)`)。
- **静默残次**:另一版是真矢量但只剩两个颜色,网格和准星整个丢了,肉眼在小图上看不出少了东西。
- ⇒ 收到「SVG」先数元素:`grep -c '<image\|base64,\|<path\|<rect'`;再渲染读**四角像素**;
  再数**用到的颜色数**与原设计对比。
- ⇒ favicon 的战场是 **16px**,而生成图是按大图构图的。实测:某版墨迹只铺到画布 53%,
  剩下是纸白底板 —— 而底板在浅色标签栏上等于透明,于是 16px 里一半像素什么都没画。
  **「太淡」的第一诊断不是笔画细,是图没铺满画布**(先按加粗修过一次,方向错了)。
  量化口径:在**真实标签栏底色上**渲染 16px 数深色像素占比(实测 10% 看不清 / 17% 可用 / 26% 清晰)。
  1254 画布上 24 单位的刻度渲染出来是 0.31px —— 这种细节加粗到任何值都救不回,该删。
