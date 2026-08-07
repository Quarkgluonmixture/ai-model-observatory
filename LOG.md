# LOG

Append-only。发生了什么，以及**为什么**。做完的事从 `TODO.md` 删掉之后，它的理由留在这里。

标签固定五个，可多标：`#decision`（决定做/不做/回退）· `#measure`（测量结果，**必须带 n / 日期 /
怎么复现**）· `#deadend`（试过不行，连同排除它的证据）· `#incident`（踩坑/事故）· `#ship`（落地）。

```bash
grep -n '^## ' LOG.md              # 全量目录
grep -n '#deadend' LOG.md          # 试过什么不行
grep -n -A4 '#measure' LOG.md      # 所有数字连同出处
```

---

## [2026-08-07 第三轮] `describe-change` 报的不是站上的数——而它是自合三条件之一  #incident #ship

起因是被问「#45 为什么不处理」。我一直把它当编辑判断（TODO 里原话「效率档行更精确，但会改动两个已
发布的数字」）。**去查了之后发现这个前提是假的。**

PR #45 正文说：

```
Claude Opus 4.8 · ARC-AGI-2: 72.08 → 62.22 ↓
GPT-5.5      · ARC-AGI-2: 85    → 83.33 ↓
```

**实测（把它的 alias 叠到当天 main 上跑 ingest）：72.08 → 72.1，85 → 85。** 没有任何东西掉十分。

#measure 证据链：ARC Prize 官方榜和 Epoch 的 ARC verified 镜像发的是**同一批测量**，档位两边都记全、
逐格吻合（low 62.2/62.22 · medium 71.7/71.67 · high 72.1/72.08 · xhigh 85/85）。#45 做的是把官方榜
那批带档位标签的串接上来，**纯增量**。站上那格从 Epoch 的 72.08 变成官方的 72.1，是
`source_kind: benchmark` 正确地压过了 `independent` —— 就是 AGENTS.md 第 3 条源优先级。

根因在 `scripts/describe-change.mjs`，两层顺序依赖叠在一起：

- `parse()` 的 key 是 `modelId|benchmarkId|harness|effort`，用 `Map.set` → **两个源发同一个操作点时后
  者覆盖前者**，其中一行对这份报告等于不存在。
- `cellsOf()` 取**第一个遇到的 row** 当这格的值。Map 迭代顺序 = 首次插入顺序 = 生成文件行号顺序。

于是：before 只有 Epoch 行（896 行起，high 先插入）→ 报 72.08。after 官方行排在 **25 行**（low 先插入）
→ 报那个 key，而它的值又被 901 行的 Epoch 62.22 覆盖 → 报 62.22。**「↓10 分」完全是行号的产物。**

⚠ 这是同一个文件里同一类事故的**第三次**（前两次的记录就在它自己的注释里：AA 刷新改了目录数字它看不见、
自报数据被改判源等级它说「什么都没变」）。前两次和这次的方向都是**假阳**（拦掉了本来没问题的合并）。
**危险方向一样容易发生**：真被改动的数字若落在「首个解析行没变」的格子里，`moved` 就是 0，而
`moved == 0` 正是无人值守自合三条件之一。

修法：主行规则不再在这里近似，直接从渲染看板的模块 import ——`app/model-data.ts` 导出
`byPrimaryPreference`，`cellsOf()` 用它排序取 `[0]`；`parse()` 的 key 加上 `sourceLabel`；正则补抓
`evaluationDate`（那条规则要按日期排序，之前根本没取这个字段）。

修完 #45 的真实报告：**1 个数字变化 72.08 → 72.1 ↑**，外加一条新的「证据等级变了
independent → benchmark+independent」解释它为什么会动。回归：干净树对 HEAD 报「无改动」；对
HEAD~2 只报那 4 处 qwen3.7-plus 目录数字。

## [2026-08-07 第二轮] 把三个「坏了也没人知道」的洞堵上  #ship #decision

同日第一轮修完 argv 之后，TODO 里剩的三条 P2 全是同一个形状：**故障存在，但没有任何东西会说出来**。

**1. AA refresh 是发射后不管。** `upstream.yml` 用 `gh workflow run` 触发就走，从不读结果。所以
这里唯一能出声的失败，是 `open-aa-pr.sh` 自己 catch 的那一个（PR 开不出来）。今早的
`Argument list too long` **恰好**落在那个 catch 里——同样的 body 要是噎死的是 `npm run ingest`，
整个 job 红掉，没有任何人知道，直到有人想起来「AA 怎么一周没刷新了」。加 job 级
`if: failure()` 推送。**不是新增类别**：「something is broken」本来就是这条通道保留的两件事之一，
这只是补上它够不着的那一半。

**2. main 变红没人知道。** `AGENTS.md` 白纸黑字：**EdgeOne 合并即发布、不看 CI**。所以 main 上一个
红勾不是「等着被修的构建」，是**一个契约正在失败的站已经上线了**。四条推送全在说别的事。
`ci.yml` 加 `if: failure() && push && main`。只管 main，PR 变红是 PR 自己的事。

**3. 等人判断的分支被覆盖——第一版设计是错的，当天就推翻了。** #deadend

第一版 `pr-engaged.sh` 用「有没有非 bot 的 review/comment」判断该不该手下留情。对着线上一测就穿了：
**PR #45 返回空**——因为你还没留言，你还在想。而 #45 正是这条规则要保护的那个。
「等看到评论再保护」等于「等人开始辩护了才保护他的判断」。

改成两种信号，按分支的**含义**分： #measure（对着 #45/#48 实测）

| 分支 | 信号 | 为什么 |
|---|---|---|
| `auto/attribution` | **open 就算**（`--any-open`） | 闸门三条件满足会自己合并并删分支——所以这里还开着的 PR 不是「待评审的改动」，是**闸门已经判定自己判不了**。人从那一刻起就欠一个判断，跟他有没有打字无关。实测 → `45` |
| `auto/refresh-aa` | 评论 / review / **非 bot 的 commit** | AA 连续重测，用新数覆盖旧数正是这个分支该干的事；只有人自己的活才是停手的理由。#48 就是这个形状：那 4 个目录值的对账是**写在分支上的一个 commit**，force-push 会直接删掉它。实测 → `nonbot_commits: 2` |

⚠ `--any-open` 的代价写进 TODO 和脚本注释了：**#45 一天不处理，新的 alias 提议就一天不流**。
接受它，因为这个系统的前提就是「错的归属比晚的归属贵」——卡住看得见，被改写看不见。

## [2026-08-07] `gh --body` 撑爆 argv：一个 bug、四个调用点、两道天花板  #incident #ship

今早 06:58 微信响了第四条推送「⚠ AA 已刷新，PR 未创建」。**告警本身是对的**：它准确说出自己
失败在哪一步、没有谎称 PR 已开、分支 `f2388cc` 完好。根因在 `scripts/open-aa-pr.sh:74`：

```
/usr/bin/gh: Argument list too long
```

body 200,061 字节，作为**单个 argv 参数**传给 `gh pr create --body`。Linux 的 `MAX_ARG_STRLEN`
把单参数卡在 128 KiB（32 页），跟总的 `ARG_MAX` 无关——所以 `execve` 直接失败，`gh` 根本没启动，
报错来自 bash。#measure：200,061 字节里 `drafts.md` 占 200,061 中的绝大部分，`--all-new` 草拟了
**213** 条记录，其中 **118** 条是零证据模型，每条都印着脚本自己的警告「别现在加，会拉低 cell
coverage」。

两道天花板，位置不同，**只修一道会把故障推迟四周**：argv 单参数 128 KiB；GitHub 的 issue/PR body
上限 65,536 **字符**（不是字节）。所以 `scripts/gh-body.mjs` 两道一起收：落盘走 `--body-file`，
按字符截断到 60,000，按行边界切、补齐落单的 ``` 围栏、写明省略了多少字并给出 run 链接。
截断必须自报——这个项目已经学过一次「对自己的结果说谎的通知，花掉的是这条通道唯一的本钱」。

四个调用点全部改掉（`open-aa-pr` / `open-refresh-pr` / `attribute-and-merge` / `publish-gaps-issue`，
共 6 处）。只有 AA 那条现在撑爆，其余三条是同一个写法，早晚轮到。

顺带砍掉噪音源：`draft-model-record.mjs --with-evidence` 只草拟归档已能填的模型。
#measure：213 → 95 条（200,061 → 81,061 字节），零证据条目 0 漏网；被压下的 118 条**打印计数**
并给出取回命令——不做静默截断。

## [2026-08-07] 让两个调度器互相看守：沉默不再有三种含义  #decision #ship

8-06 把微信从十条砍到四条是对的，但没算进去的代价是：**「手机上没消息」现在同时意味着
一切正常 / GitHub 挂了 / hermes 没跑**。只在异常时说话的通道，只有当「没说话」本身可被检验时
才可信。

不是假想。`AGENTS.md` 自己写着：每日刷新在提交前跑 `npm run build`，而 build 现在包含个人站——
所以 `app/page.tsx` 一个 type error 就让数据管线整条停摆，不提交、不开 PR、不推送，唯一症状是
「什么都没发生」。反向同理：hermes 到 8-06 才装上定时任务，在那之前只在开对话框时才动，
这件事从 GitHub 这侧完全看不见。

`scripts/check-heartbeat.mjs`，两个方向，只用已有产物、不新增任何产物：

- `--github`（hermes 每轮开头跑）：`Upstream` workflow 36h 内有没有跑完。阈值取 36h 不取 24h，
  因为 GitHub 对 cron 的延迟实测在 06:56–08:10 之间飘，24h 会误报。**这是 hermes 唯一值得推微信
  的发现**——那个 job 死的时候，它是攥着通知通道一起死的：四条推送全部由它或 CI 触发。
- `--agent`（每日 job 跑，写进 gaps issue，**不推微信**）：main 上最近的非 bot 提交。阈值取
  **3 天**不取 1 天，因为「今天没活干」是合法的，「三天没人动而队列非空」不是。它有意区分不了
  hermes 和人——两者都以人的身份提交——所以它回答的是「这个队列还有没有人在做」。

`--github` 顺带解决一个没人提过的问题：**绿的心跳意味着你正要读的队列是今天的**。
8-07 之前没有任何东西验证这件事，而读着一周前的 gaps issue 的 agent 会做出自信、规范、无用的活。

## [2026-08-07] 等人判断的 PR 不再被每天覆盖  #decision

`attribute-and-merge.sh` 每天 force-push `auto/attribution` 并重写 PR body。**没人看的时候这是对的**
——一个永远反映今日提议的 PR，胜过一队过期 PR。人一开始读，它就不对了：PR #45 正在问
Opus 4.8 / GPT-5.5 的 arc-agi-2 该不该换主行（被三条件正确拦下），而明早它的内容会在**决策进行中**
被换掉。

现在：远端已有 open PR 且带非 bot 的 review/comment → 本轮完全不碰远端，写 workflow warning +
step summary。**什么都不会丢**：gate 是确定性的，今天提的明天照提，PR 一旦合并或关闭就自动恢复。
卡住的队列看得见，被改写的判断看不见。

顺带把章程和代码对齐：`docs/AGENT-OPERATIONS.md` 的分工表原本把 alias 整体划给 hermes，而闸门在
GitHub 上写同一个 `data/model-aliases.json`——章程第一句就是「两个调度器不许碰同一个文件」。
现在写明这是**唯一的例外**，并围起来：闸门只写证据能定的那一半、只在自己分支上、永不写例外条目；
它拒绝的全部归 hermes；两者错开三小时，写 alias 前必须紧挨着 rebase。

## [2026-08-07] qwen3.8-max / qwen3.7-plus 接上 provider 价对照  #ship

`PROVIDER_LOOKUPS` 漏了这两个已上游的目录模型，所以它们的价格卡从不显示
OpenRouter 实时对照。两个 id 都先对着 `openrouter.ai/api/v1/models` 验过是**精确匹配**
（不是子串——那条路把 GPT-5.6 Sol 卡渲成 Luna Pro 的 $0.10/$0.60 过）：

- `qwen/qwen3.8-max` → $2/$6，与目录价**一致**
- `qwen/qwen3.7-plus` → $0.32/$1.28，与目录价 $0.4/$1.6 **不同**——这正是实时卡该露的：
  归档价旁挂 provider 价，不覆盖。差异是信息，不是错误。

tier B，三条件全满足自合：契约全绿 · `describe-change` 报「不改变任何已发布的数字」· 无任何
`acknowledgedDisagreements`/`mergedInOneSource` 例外。`report:gaps`（带网络）复核：两个模型不再
被标「served upstream but no entry」，也没引入 dead lookup。

## [2026-08-06 16:02] 建立 CHECKPOINT / TODO / LOG 三件套  #decision

仓库原本只有"永久真相"层（`AGENTS.md` 操作合同、`docs/ARCHITECTURE.md` 唯一真相、
`docs/AGENT-OPERATIONS.md` 章程），缺 session 交接层——每次接手都要从 22 个批次和 4 份文档里
重新拼现状。三件套只补这一层，**不动已有分工**：结构性的「已知限制」仍然只在 §10，TODO 只放
做完就能删的事。

## [2026-08-06 15:40] LMArena 接成第 9 个脚本源，Elo 每天自更新  #ship #decision

`lmarena.ai` 现在 301 到 `arena.ai`，新站每块板**服务端渲染**，整份快照以 JSON 嵌在 HTML 里——
不用浏览器、不用 key、一次 fetch。§9 原来那条"没有机器可读路径"说的是 `lmarena/arena-catalog`
那个停更了一代的 GitHub 镜像，**从来不是关于站点本身的判断**。这是那张表第六条被"再看一眼"
推翻的判定。

两块板都按 AGENTS.md 的规矩验过（拿目录里已有的模型对页面）：
`text-overall-style_control` → Fable 5 = 1508.58（归档 1508）；
`webdev-overall-raw` → claude-opus-5-max = 1705（归档 1712）。code 那边低几分是因为那块板比
7/27 的手抄批次新十天——**那正是一直在悄悄变旧的东西**。493 行，模型串和归档写法完全一致，
零个新 alias 要判断。

取整到整分：板子自己显示整数，归档每行都是整数，发布区间约 ±6，保留小数是这个测量没有的精度，
而且会让批次每天被无意义重写一遍。

`/api/` 路径答 403 "Route not allowed"，所以走页面自身的 payload。 #deadend

## [2026-08-06 15:10] 接入前发现漂移检查和审计各有一个致命盲区  #incident

两处不改，这个源接进去就是"已自动化的冻结源"：

- **漂移检查对参数行只比 7 个字段**，`text_elo`/`code_elo` 不在其中 → 会拿 7 个 null 去比较、
  永远显示"没变化"、永远不刷新。
- **参数行的 key 是 模型+档位**，同一个源在两块板上发同一个模型必然撞车 → Text 的行在和 WebDev 的
  行互相比较。key 现在带上来源。

审计（`check-model-provenance.mjs`）也补了同一课：它的三级取值在同级候选里**按归档文件顺序**挑，
这在"每个源只读一次"时无害，读第二次就错——新 Arena 行和手抄行并排躺着，它一直取十天前那个，
然后报告目录和归档差一分。**每一级里现在是新的胜出。** 它的 Arena 守卫也只匹配 `lmarena.ai`，
新域名会径直绕过"Arena 价格列不作价格来源"这条规则。

## [2026-08-06 14:50] Elo 改为从归档派生，不再写在目录里  #decision #ship

Elo 每投一票就动，写进目录记录的数字第二天就旧；每天刷新它会让 `check:models` 天天跟目录打架
（这正是 AA 被排除在每日巡检外的原因）。`npm run ingest` 现在派生 `ARENA_ELO`，目录读它——
**归档成为这个数字唯一存在的地方，审计也就没有可争的了。** 顺带修掉一个老毛病：Arena 不发布
分档位榜单，Elo 从来就不是"某个运行档位的属性"。

验收 #measure：29 个模型 **27 个数字一模一样**；变的两个都是修正——Opus 4.8 的 code Elo
`1539 → N/A`（归档里从来没有这一行，`check:models` 一直在报它无源），Gemini 3.1 Pro
`N/A → 1446`（归档里一直有，只是没被抄进目录）。当天晚些时候接入实时榜后，Opus 4.8 那个数
以 1539 回来了，这次带出处。

**闸门在合并前抓到我两个错，两个都不会让任何检查报红：** ①把归档压成"每模型一行"，于是"取最新"
在同一天的两行之间静默选了文件靠后那条，把 Opus 5 的 Elo 挪了两分；②"先旗舰档、取不到就随便取"
漏掉中间一级——**没标档位的那行是板子的模型级陈述**，裸 `gpt-5.5`（1476）优先于恰好排在前面的
`gpt-5.5-high`（1482）。

`describe-change` 连带修了两处,第二处更要紧:它按位置解析 `cfg()`,删两个参数就全体错位;
更糟的是 Elo 离开目录文本后**掉出了它的比较范围**,而这个比较是自合三条件之一——等 Arena 每天
刷新,全目录 Elo 变动会被描述成"没有任何改动"。现在从生成文件里读,单独成节,且**刻意不计入**
"已有数字被改动"(实时测量若计入,自合条件永远为假,闸门就变成要绕开的东西)。

## [2026-08-06 14:20] 微信推送从 10 条砍到 4 条  #decision #ship

原来有 10 个推送点（比先前以为的 5 个还多，三个脚本里各藏着一两个）。砍掉的 6 条共同点是
**"你收到也做不了什么"**：板子动了、厂商发文了、AA 测了新模型、上游出现新模型、缺口 issue 建立、
自动 PR 开了——这些现在都有一个不是人的消费者。

其中一条比噪音更糟：上游新模型那条结尾写着「回一句『收 <模型名>』」，而 **PushPlus 只能发不能收**。
从写下那天起就没有任何东西能接住这句回复。它长得像个接口，其实是死路。 #incident

留下 4 条：站上新增模型 / 归档完整性失败 / 完整性恢复 / AA 刷新但 PR 没开成。新的那条挂在
`ci.yml`，因为目录记录可能从三个方向落地（闸门、hermes、手合 PR），三条路都以 push 到 main 结束。

**周一心跳也砍了,代价明说**:沉默从此不可诊断——管线停了不会表现为"少了一条消息",而是 Actions
历史空了。用户知情后拍的板。

## [2026-08-06 13:30] 归属闸门：把 alias 里不需要判断力的那一半交给机器  #ship #measure

「这个字符串是哪个模型」是 board 发一行数据到站上显示之间的最后一个人工步骤，也是最危险的一步
（错了 A 的分数会挂在 B 名下，七项检查全绿）。所以这不是把判断力自动化，是**量出其中有多少
根本不需要判断力**。

回测 ground truth = 仓库自己的历史，**这个回放现在是 CI 的一步**：
- 人已做过的 **239** 条映射：**127 条重现（53%）、0 条相反**
- 文档里明确"故意不映射"的 **21** 条陷阱串：**0 条被误映射**

四条拒绝规则，每条都是量的时候被假阳打出来的： #deadend
1. 候选家族的**版本号必须出现在串里**——否则 `gpt-5.6-sol` 会佐证到 `gpt-5.5`（一代分裂成
   Sol/Terra/Luna，后继和前代分数接近是常态，不是证据）
2. 剥掉家族自身 token 后**不许有残余**——`gpt-5.5-pro-pre-release` 和 GPT-5.5 在某格吻合到 0.2%
   以内，但 Pro 是另一个模型、pre-release 又是另一个
3. **同源发布带后缀的兄弟串 → 拒绝**（DeepSeek V4 Flash：裸串在三个榜上是预览版、第四个上是正式版）
4. 比较必须**同 benchmark + 版本 + harness + effort**——只按 benchmark 比，同一模型不同 harness 的
   行会被当成自相矛盾，把正确答案挤掉、留下错的

它**不自己合并**：只有在没有任何已有数字被改动时才合。首跑就撞上这条——接上 Opus 4.8 和 GPT-5.5 的
效率档行后 `arc-agi-2` 两格主行换了，于是留 PR。同一次运行还逼出一条和归属无关的规则：**闸门必须
对 `check:models` 自己的等价类封闭**（它映射了 `GPT 5.5 (high)` 却漏了 `GPT-5.5 (High)`，正是那个
检查存在的理由，由本该防止它的东西亲手制造）。

## [2026-08-06 12:00] Qwen3.8 Max 进目录；`intelligence` 改为可为空  #decision #ship

发布三天的模型有 36 格可填数据（LiveBench 23 + Epoch GPQA + DeepSWE + ALE + GDPval + 厂商发布表 12）
却进不了目录，因为 `ModelConfiguration.intelligence` 不可为空、而 **AA 的参数 API 还没测它**。
一个模型无论有多少 benchmark 证据都要等第三方发布一个复合指标——这条依赖硬编码在类型里。

改成 `number | null`。综合能力栏显示 N/A，其它 lens 照常排名，性价比 lens 按"比值缺一半就不成立"
剔除。**这是把第 1 条铁律（缺证据就是 N/A）用在目录自己的 schema 上**，那是代码里最后一处强制
要求一个可能不存在的数字的地方。

价格取自厂商：两张 list price 表(Alibaba Model Studio、QwenCloud docs)到当天都还停在 3.7 系列,
marketplace 的模型卡有 $2/$6。**这张卡能当 list price 用是验证过的**——同一张卡对 qwen3.7-max 印着
`50% off $2.5→$1.25`,而 $2.5/$7.5 正是归档里的 list price;3.8 那张没有折扣标记。

⚠ **AA 是好几个面**:它的 GDPval-AA 榜当天就收了这个模型,而参数 API 没有。"AA 还没测"这句话
必须说明是哪个 AA。 #incident

## [2026-08-06 早] hermes 没有定时任务——链路断在"没人喊它起床"  #incident #decision

排查结论：hermes **会**干活（PR #8「Add Qwen3.7 Plus」8/1 已合并是它开的）、**够得着** GitHub
（自己在 issue #7 上回复过）、**跑过体检并通过**（8/5，HEAD `98f483c`，七项全绿）。活也**已经送到
它门口**（探针每天把发布页写进 gaps issue）。

唯一缺的：**没有任何东西喊它起床。** 它那台机器上有 7 个 cron，没一个碰这个仓库；而它的章程第一条
就是"只在触发器响了之后才动"。skill 写得再好也不会被执行——**skill 是说明书，不是闹钟。**

修法：加第 8 个 cron。不用 API key、不用新服务。当天装上并手动触发验证通过 —— 首次排程运行
正常，`git pull` → `npm ci` → ingest 干净 → 队列排查完毕。

⚠ 时间要点：GitHub 那个每日巡检写的是 `0 6 * * *`，但实际连续五天在 **07:58–08:54 UTC** 之间才跑
（GitHub 定时任务常态性延迟约两小时）。hermes 必须排在那之后，否则每天读到的是昨天的队列。

## [2026-08-07 第四轮] ARC Prize 接成第 10 个脚本源（batch 23）  #ship #measure #deadend

只做**判断无关的一半**：证据落地，站上零变动。198 行里只有 2 行已有 alias（`gemini-3.1-pro` 77.08、
`glm-5.2` 22.78），`describe-change` 报「没有任何已有模型的数字被改动」，唯一变化是 GLM-5.2 那格
从 `independent` 升成 `benchmark+independent` 而分数一致 —— 正是「Epoch 逐格转录 ARC」的推论。

`docs/ARCHITECTURE.md` §9 那条「The verified board publishes nothing readable」被推翻，是那张表
**第七条**被「再看一眼」推翻的判定。

**三件事在写的过程中被数据否掉，每一件都会静默产出错数据：** #deadend

1. **从 modelId 尾部解析 effort —— 看着安全，不是。** 尾 token 分布：`high/low/medium/xhigh/
   minimal/max` 是档位，但 `-1k/-8k/-16k/-32k/-64k` 是 Claude 的**思考 token 预算**、
   `-openrouter/-together/-bedrock` 是**服务路由**、还有一堆是日期和 release tag。预算写进
   `reasoning_effort` 会同时污染漂移 key 和 alias 解析（effort 在这两处都承重）。
   → `reasoning_effort` 全部留空，model_raw 逐字保留。LiveBench 就是这个形状（AGENTS.md 原话
   「effort baked into the string」），解析归 alias 步骤。
2. **`evaluation_date` 不能拿 `models.json` 的 `modelReleaseDate` 顶。** 那是**模型发布日**不是
   评测日，而这个字段是站点排主行的排序键之一 —— 拿一个意思不同的日期喂它，会静默重排格子。留空。
3. **冻结源必须实现 `archiveVersion()`，而漏了它只在漂移路径上炸。** fetcher 能写、能跑、能落一个
   看起来完全健康的批次，然后**第二天早上把每日巡检弄红**。这次就是：`--check` 抛
   `fetcher.archiveVersion is not a function`。∴ 新 fetcher 一定要单独跑一次 `--check`，
   落完批次不等于验完。

**上游自己有一条重复**：`gpt-5-2025-08-07-low` 在这个 split 上出现两次、都 display、分数都是 1.94。
放着不管会在漂移 key（`model/benchmark/harness/effort`）上碰撞、静默只看见后一条 —— 今天无害，
哪天 ARC 让它们不同就会藏起一个分歧。∴ 完全相同的重复收成一条并计数；**同 id 不同分则直接抛错**，
因为静默取一条正是这个项目反复吃的那个亏。199 → 198 行，与漂移检查的 198 格对齐。

验收：`check:upstream` **exit=0、零完整性失败**（`ARCHIVE_STALE=1` 来自 GDPval 这个 live 板的 Elo
移动，不是这个源）；单源 `--check` 报 `archive matches upstream, 198 cells verified`；七项契约全绿。

## [2026-08-07 尾] 探到 ARC Prize 的第一手数据文件  #measure

TODO 里「ARC Prize verified board」原本只是一行候选。按章程「动手前先重新探一遍」探了，路是通的，
证据记在 TODO 那条里（fetch 了什么、状态码、拿哪个已有模型对的、对不对得上）。

关键结论：`arcprize.org/media/data/evaluations.json`（808 行）**是第一手源，而归档里现有两份都是它的
下游** —— batch-12 是 Epoch 的转录（逐格一致、2 位小数、`independent`），batch-01 是同一批数据被人
手抄成 1 位小数。所以脚本化不是「多一个源」，是**把一个 independent 镜像换成 benchmark 原生源**，
顺带拿到全精度和免费的漂移检查。

这也解释了今天早些时候 #45 为什么会把那格从 72.08 改成 72.1：两份下游转录精度不同，谁当 primary
取决于源等级。收了第一手源之后这个纠结就消失了。

路径不在 `_next` 的 chunk 里，在 `/scripts/leaderboard/data.js` 的 `d3.json()` 调用里 —— 又一次印证
「数据住的地方不一定是页面住的地方」。#deadend 页面 HTML 里没有模型名（客户端渲染），
leaderboard 的 page chunk 只有 6KB、零 fetch，光看这两处会得出「抓不了」的结论。

## [2026-08-07 第四轮] ARC 收尾：把「effort 一律留空」这个决定推翻了，因为它让归属无法进行  #decision #incident #ship

接手 TODO 的「ARC 收尾：三个判断题」。三件都做完了，但**第一件一动手就发现前一轮的一个结论是错的**
—— 错在结论，不在观察。

**被推翻的是本文件上一条 #deadend 的第 1 点**（「从 modelId 尾部解析 effort —— 看着安全，不是」）。
那条对 token 的观察全对：`-1k/-8k/…/-64k` 确实是思考预算、`-openrouter/-bedrock` 确实是服务路由。
但从「有些尾 token 不是档位」推出「那就一个都不解析」是**多推了一步**，而代价在 alias 步骤才现形：

> ARC 给 GPT-5.6 Sol 发五条，42.5 / 67.08 / 85.42 / 90 / 92.5，这是一个模型的五个操作点。
> effort 留空的话五条 key 到同一格 —— 接目录会**同时**撞上一源两串闸门和 20% 跨源分歧闸门，
> 而唯一的过法是写一条 `mergedInOneSource` 或 `acknowledgedDisagreements`，内容是「42.5 和 92.5
> 是同一个测量」。它们不是。而写豁免恰好是三条件里第 3 条禁止的那件事。

`scripts/fetchers/epoch.mjs` 早就从另一侧记过同一个坑：把已发布的操作点折成 null，会让它
「和那些本来就没印 effort 的源撞在一起」。∴ 改成**对着闭合清单读尾 token**（直接用 Epoch 那份，
含 `none → non-reasoning` 同义），清单外一律留空。117/198 行拿到 effort，81 行没有。
**分数零变动、行数零增减**，重采只改 `reasoning_effort` 和 `note`。

`model_raw` 仍然逐字保留（Epoch 是剥掉的）。理由是失败方向不同：**尾 token 读错只是给配置贴错标签，
剥进 id 里则是把两个产品并成一个，alias 表再也分不开。** `max` 对 Anthropic/OpenAI 是档位，对阿里是
产品档 —— 身份判断留在 alias 步骤。

**判断题一：52 条 alias。** 37 条是**用数字确认的**（同一 model+effort 格上和 batch-12 里已归属的
Epoch 行逐位对上）。剩 15 条 —— Claude Fable 5、Gemini 3.6 Flash、Inkling Small —— **没有第二个源
测过它们的 ARC**，靠的是同批次内已被数字确认的同形字符串（`anthropic-claude-opus-5-max`、
`anthropic-opus-4-8-high`）加读者复核。归属闸门只自己认出 4 条（`gemini-3-6-flash-*`，tier 1）；
其余全被 maker 前缀挡下（剥完 effort 还剩 `openai`/`anthropic`/`thinky` 残余），这正是 ALE 那个形状。

**判断题二：batch 01 的 95 条 ARC 行 supersede 了。** 不是编辑口味，是三条硬事实： #measure
1. 它们已经是**字面重复**：手抄时保留了 leaderboard 自己的 URL，于是「GPT-5.5 (xHigh) 85」和
   `gpt-5-5-2026-04-22-thinking-xhigh 85` 同源同配置同分 —— `check:data` 直接报
   `duplicate observation`。这条是被契约逼出来的，不是我挑的。
2. 一位小数（85.4 vs 85.42），且**同一批次里一个档位两种拼法**（results 页写 `extra high`、
   leaderboard 页写 `xhigh`），把一个操作点分进两格。
3. ⭐ **它的 `evaluation_date` 根本不是评测日。** 逐个对过：Sol 2026-07-09、Opus 5 2026-07-24、
   Inkling 2026-07-15、Opus 4.8 2026-06-01、GPT-5.5 2026-04-22、Gemini 3.1 Pro 2026-02-19 ——
   **全部等于 `models.json` 的 `modelReleaseDate`，一天不差**。而 `byPrimaryPreference` 拿这个字段
   排序，所以**一个发布日一直在决定站上显示哪条 ARC 行，且每次都选中那个手抄的整数版**。
   上一轮为 batch 23 留空 `evaluation_date` 是对的（第 2 点），但真正的问题不在新批次而在旧批次。

∴ 「不 supersede 就让全精度行一直等着」这个顾虑连同它的前提一起消失了。

**判断题三：v1/v3 收不收 —— 问了人，答复是两个都收。** 数据先摆出来再问的：ARC-AGI-1 有 197 行、
16 个家族、77–98.5（顶部三家厂商都在 97.5 以上，饱和），ARC-AGI-3 只有 26 行、6 个家族、除 Opus 5
的 30.16 外全在 8% 以下。∴ 分别记 `legacy` 和 `observe`，都不进 portfolio floor（实测：reasoning
core 篮子仍是 gpqa / hle-no-tools / arc-agi-2 三项，没有任何已发布均值移动）。

一份文件八个 split，所以 `arcprize.mjs` 改成工厂、导出三个 board（batch 23/24/25）。**共用函数体是
为了不漂移**：split 过滤、display 过滤、重复规则、effort 清单、note 五处只写一遍。

**三个附带发现，每个都会静默出错：** #deadend
1. **TypeScript 有个行数天花板，而归档今天正好走进去。** `ObservationRow` 有四个可选属性，所以每行
   字面量形状不同，TS 检查数组字面量时会对所有行做并集；**过约 1,120 行这个并集就无法表示**，
   `npm run build` 报 *Expression produces a union type that is too complex to represent*，指向生成
   文件第 6 行 —— 读起来像文件坏了，不像归档变大了。实测：1,116 → 1,138 行触发，砍到 1,113 通过。
   ∴ `ingest.mjs` 改成按 300 行分块、各自标注 `ObservationRow[]` 再展开，并集从此只在块内构建。
   **每日刷新离自己撞上它只剩几天。**
2. **两条「看名字该映射」的字符串靠 `modelGroup` 才判掉。** `openai-gpt-5-5-2026-04-23-high` 显示名
   就是「GPT-5.5 (High)」、不带 Pro；`google-gemini-3-1-pro-preview` 显示名就是「Gemini 3.1 Pro
   (Preview)」。但两者的 `modelGroup` 都和目录已收的那条不同（且 04-23 正是 ARC 给 GPT-5.5 **Pro**
   的日期）——**同名不同 group = 板子自己说这是两个带日期的快照**。∴ 都不映射，代价两格 0.43/0.42。
   顺手把 `modelGroup` 写进每行 note：显示名撞车时它才是判身份的字段，不存就得回头重抓 models.json。
3. **工厂参数 `dataset` 被函数内 `const dataset` 遮蔽**，于是 `fetch()` 不带参数是 TDZ 抛错 ——
   新克隆、归档还不存在时正好走这条路。lint 的 `no-unused-vars` 逮到了这个遮蔽；崩溃会等到那天。

验收：七项契约全绿（1391 观测 · 980/2030 格 · 48.3%）、归属闸门回测 300 条 0 contradicted /
0 false positive、三个 board 各自 `--check` 报 archive matches upstream、`check:mobile` 三档无溢出
（跑完已停 3111 端口的 server）。**`mergedInOneSource` 和 `acknowledgedDisagreements` 仍然是空的**
—— 这次没有靠任何豁免过闸。

覆盖率读数 48.6% → 48.3%：分母进了 58 格（两列 × 29 家族）而证据只进了 22 格。README 里写过这个
方向是有意的，「三个数字一起读，别只读百分比」。

⚠ **这次改动不能自合**：`describe-change` 报 7 个已有数字被改动（全是 1 位小数 → 全精度，
最大 0.04），三条件第 2 条不满足。开 PR 等人。

⚠ 顺带纠一个容易想当然的地方：`feat/arc-attribution` 开着**不会**暂停归属闸门。
`pr-hands-off.sh` 查的是 `gh pr list --head auto/attribution`，**只看那一个分支**。
所以两边会同时写 `data/model-aliases.json`，合之前得先 rebase。
