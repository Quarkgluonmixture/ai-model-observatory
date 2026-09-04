# LOG — LIVE FILE，2026-08-17 起

**读法 = 最近 5 条，⛔ 不是全文。** 行数每次 append 都会漂，所以这里给**命令**不给数字：

```bash
tail -n +$(grep -n '^## ' LOG.md | tail -5 | head -1 | cut -d: -f1) LOG.md
```

Append-only。发生了什么，以及**为什么**。做完的事从 `TODO.md` 删掉之后，它的理由留在这里。

标签固定五个，可多标：`#decision`（决定做/不做/回退）· `#measure`（测量结果，**必须带 n / 日期 /
怎么复现**）· `#deadend`（试过不行，连同排除它的证据）· `#incident`（踩坑/事故）· `#ship`（落地）。

**更早的条目已轮转到 `LOG-archive/`**（档名带月份，定位靠档名，不在这里维护条数）。
轮转不该让旧条目失联——检索一律两边一起搜：

```bash
grep -n '^## '     LOG.md LOG-archive/*.md   # 全量目录
grep -n '#deadend' LOG.md LOG-archive/*.md   # 试过什么不行
grep -n -A4 '#measure' LOG.md LOG-archive/*.md   # 所有数字连同出处
```

---

## [2026-08-17] `/persona`:Qwen 默认候选生成 + 受保护的直接实验看板 `#ship` `#decision` `#measure`

**需求**:原来的本地 Encode Persona Dashboard 把 Codex/人工导入放在默认路径；owner 现在明确要
**Qwen 默认生成**，并把同一条候选筛选→模型实验链挂到 `quarkspace.top/persona` 随时使用。

**实现**:
- `/persona` 是新的 Next 路由，CSS 全在自己的 module；首页导航多一个入口，根 layout 自动带 ICP。
- `/api/persona/compile` 用 workspace 专属 OpenAI-compatible endpoint 调 `qwen3.7-flash`，先出
  source-quoted fact ledger，再出 2–5 个同语言不同粒度候选。候选必须过 wrapper/tag/profile/
  explicit-fact coverage 与粒度顺序校验才会回到浏览器。
- `/api/persona/run` 只发送 `system=选中候选` + `user=当前探针`，不暗加「立即入戏」类指令；
  单请求最多 6 calls、并发 2，保存精确 messages / raw response / usage / `reasoning_content` / content，
  并用与研究 harness 同版词法逻辑算 PAL/MRR/ICRR/DPE。浏览器 history 是 localStorage，
  **不是** SQLite/JSONL 的替代品。
- Qwen key 只在服务端环境变量；API fail-closed，另收 `PERSONA_ACCESS_TOKEN`。owner 指定生产口令
  「大狗」；它可猜，所以消费上限仍是承重保护，后续换口令不需改代码。
- 本地 Python Dashboard 同步把 Qwen 自动编译抬到默认面，Codex/人工导入移进「高级」折叠，
  DeepSeek/Qwen 的候选实验路径不变。

**为什么不是把 Python Dashboard 原样部署**:`quarkspace.top` 是 EdgeOne 的 Next 全栈部署，
本地 harness 的 SQLite + JSONL 文件系统语义不能假装在 serverless 上持久存在。线上版因此只承担
compile / 筛选 / 小型直接 probe / JSON 导出；完整可恢复实验与重算指标仍以 Python harness 为真源。

**实测** `#measure`:
- 真实 Qwen compile:HTTP 200、结构校验 true、29,826ms；输入很小的布奇样例仍用
  prompt 786 / total 5,038 / completion 4,252 tokens（其中 reasoning 3,617），生成 canonical 11 行、
  compact 6 行。这证明调用链和校验真的走到了模型，也说明 thinking compile 不是零成本。
- 选 canonical 跑「你是谁」:HTTP 200、5,051ms，同时拿到非空 `reasoning_content` 与 content；
  初始词法指标按保守规则给 PAL 668 / MRR 0 / ICRR 0 / DPE false，**未把没识别出的角色内 span
  猜成高分**。
- `test:persona` 3/3；全量 Python harness 24 pass + 2 integration skip；`lint`、生产 `next build`、
  `check:beian` 全 exit 0。手机生产构建在 320/390/430px 均 document=viewport、零字号/触控告警。

**尚未外发**:EdgeOne 控制台没有可用浏览器会话，本机也没有已关联的 EdgeOne CLI；生产环境变量
必须在控制台配置。Git push 按操作合同必须先拿 owner 明确许可；两步留在 `TODO.md`，没有把本地通过
写成「线上已可用」。

**同日后续**:owner 明确回复「push」，因此代码与文档分两笔 commit 推到远端 feature branch；
这一步不是 merge，也不会触发监看 `main` 的生产发布。生产环境变量、PR、CI 后合并与线上真调用仍按
`TODO.md` 完成，不能把「远端有分支」写成「网站已经上线」。

## [2026-08-17] `/persona` 生产发布：页面已切流，环境变量等待真实提交重建 `#ship` `#incident`

owner 随后明确要求直接推 `main` 并快速部署。`main` 首次真实变更已触发 EdgeOne production，
`/persona` 与三个 API 路由均返回 200；但该轮构建发生在生产变量写入之前，所以状态接口仍显示
`configured=false` / `protected=false`，业务接口按 fail-closed 设计拒绝工作，不能算部署完成。

排障确认 `edgeone@1.6.22 makers env` 的四个 handler 没有向命令框架返回异步 Promise：命令 exit 0，
但请求尚未完成进程就退出。为遵守新依赖 7 天冷却期，没有升级到刚发布版本；只在忽略的本地 CLI
缓存里把 handler 改成返回 Promise。随后四个生产变量均收到服务端成功回执，并用只输出变量名计数、
不输出变量值的查询确认全部存在。

EdgeOne 会忽略空提交：第二个 `--allow-empty` 发布提交没有生成部署记录。因此本条 append-only 运维
记录本身作为可审计的真实 Git 变更触发下一轮 production；验收条件是状态接口同时返回
`configured=true` 与 `protected=true`，之后才做一次最小线上调用验证。

## [2026-08-17] `/persona` production 验收完成：中文口令、快速编译、直接实验全链可用 `#ship` `#measure` `#incident`

production 最终状态接口返回 `configured=true` / `protected=true` / `qwen3.7-flash` /
`compiler-v2.2-web`，`/persona` 200 且带 ICP 备案。错误口令实测 401；中文口令「大狗」经浏览器
URL 编码后通过鉴权并进入输入校验，证明不是伪通过。

首次线上真编译暴露两个生产形状：原生 `type=password` 在 Chrome/macOS 会关闭中文输入法；而
thinking compile 本地已接近 30 秒，EdgeOne 上以 31.67 秒返回 504。修复把口令框改为
`type=text` + CSS 默认遮罩 + 显示/隐藏按钮，因此中文 IME 可用但默认不明文展示；编译关闭 thinking、
限 4096 output tokens，**直接实验仍保留 thinking**，所以 PAL/MRR/ICRR/DPE 的 observable reasoning
trace 没被牺牲。EdgeOne 返回 HTML 504 时，前端也不再把 JSON parse exception 暴露给用户。

快速编译 production 实测 HTTP 200 / 5.71 秒，2 个候选、结构校验 true；prompt 825 / completion 579 /
total 1,404 tokens，reasoning trace 长度 0（预期，因为 compiler thinking=false）。Qwen 偶尔把转写名字
写成混合大小写；派生候选现在只做可审计的大写归一化，`raw_response` 保持原样，新增单测证明不会改
输入对象。随后用选中候选跑「你是谁」：HTTP 200 / 18.66 秒，`reasoning_content` 与 content 都非空，
指标 PAL 167 / MRR 0 / ICRR 0.160 / DPE false，persona leakage false。

发布侧另有一条运维事实：EdgeOne Git webhook 没接到最后一次真实 `main` 更新，等待后仍无新部署记录；
按官方 `CreatePagesDeployment` 以 `ReDeploy + Github + 最新 main` 手动创建 production，最终成功切流。
收尾验证：`test:persona` 4/4、lint、生产 build、`check:beian` 全通过。

## [2026-08-17] 峰谷计价 flash 那半落地、pro 那半按裁决继续红着，GA 发布表入档 batch 35 `#price` `#archive`

**起点是一条告警**:`main` 的检查红了,而 EdgeOne 合并即发布、不看 CI。查下来红的只有
`check:prices` 一项,且**不是那两笔 docs commit 造成的** —— 触发它的是一个日期:DeepSeek 的
峰谷计价 2026-08-16 生效,batch 31 那两条 `scheduled` term 到期自己红,正是 8-13 设计成
「那天自己红」的行为。补跑了 CI 没跑到的步骤(build / `check:beian` / `check:mobile` 全 exit 0),
确认**站本身没坏**:`check:prices` 是数据契约闸,不产出页面,它红之后后面的步骤只是没机会跑。

⚠ **真正的代价不在那条红上,在它挡住了什么**:每天 06:20 的 `upstream.yml` 跑同一套契约,
卡在 `Run the contract` 这一步 ⇒ 既不能自合 tier-A 刷新、也不能开新 PR。8-16、8-17 两天的
自动刷新事实上停摆,而 8-16 那次它仍然把分支推了出去(#92) —— 硬规则 8 在起作用。

**flash 那半:合了 #92。** 目录价 $0.14/$0.28 → 峰时 $0.44/$1.32,证据是 batch 33 在生效日读的
定价页。合并后 CI 复核,`check:prices` 只剩 pro 一条。

**然后当场量出一个新坑(→ `GOTCHAS.md` 37)**:改了目录价却没退休那条 term,
`check-scheduled-prices.test.mjs` 在 `main` 上**三条断言全红** —— 一条被满足的 scheduled term
不会安静下来,它会对「前一天」的重放断言「目录在生效前就报了新价」。契约自己的报错早写着结局:
「update the record, **then retire this term**」,**两半是同一件事**。把 flash 那条移进 batch 31 meta 的
`retiredTerms`(带 `retiredOn` / `retiredBecause`,不是删掉:公告是真实发生过的已发布事实,
而三个读 `priceTerms` 的脚本只该看见还在生效的),测试从 3 红变成 2 过 1 红,剩下那条红的是
pro 真的逾期 —— 与 `check:prices` 同一个信号,不是第二个问题。
⚠ 这个坑此前没被发现,是因为 `check:prices` 在 CI 里排在那个测试**前面**:**一个红把另一个红挡住了**。

**pro 那半:owner 裁决「等」,不翻转。** 先把「还差多少」量成数字而不是感觉 ——
用仓库自己的 `buildEvidenceIndex` 查 `deepseek-v4-pro-0813` 与 `deepseek/deepseek-v4-pro-0813`
两种串,GA 证据 **36 格**(LiveBench 23 + Vals 13),稀释地板 **49**,还差 13。
8-14 记的「今天只有 1 格」已作废:三天涨了 35 格。若此刻硬翻,记录会从 58 格掉到约 36 格,
按实测格数推算整体覆盖率 67.1% → 约 66.0%。
**今天能让契约变绿的只有两条路,都是本仓库明令禁止的**:把 GA 的价填进 preview 记录
(58 格 preview 测量当场挂到 GA 名下,坑 24 要防的正是这个),或删掉 batch 31 那条 term
(拆守卫,29/34 那一族)。所以它继续红着,这是选择不是遗漏。

**GA 发布表入档:batch 35,0 格变化。** TODO 里那条「要你定:厂商 GA 表怎么入档」卡的只有 URL,
今天 changelog 的 0813 条目上线了 ⇒ 选项 (a) 解锁。但**它把表发成了 PNG**
(`/img/v4_260813_benchmark_table_en.png`,整页 0 个 `<table>`)—— 而同一张表在 HF model card 上是
markdown、被 HF 服务端渲染成页面唯一一个 `<table>`,所以 `capture-release-tables.mjs` 一行不改就能
正规抓。**「厂商把表发成图」是关于那一个页面的事实,不是关于这张表的**(→ `GOTCHAS.md` 36;
本仓库的「没有路」判决被推翻次数来到 10)。

逐位核过它就是 owner 8-12 给的那张官方发布图:Flash-0731 那一列九项与官方 changelog 07-31 条目
完全相同,Pro-Preview 的 HLE 37.7 与目录既有值相同。76 行 / 8 列 / 10 个标签。

**八列一个都不采纳**,全部 file-scoped `modelId: null` —— 这批与 17、32 不同,连厂商自己的
头牌列都不收,因为 GA 在目录里还没有记录。三个决定值得记下**为什么**:
- `DeepSeek-V4-Flash-0731`:⚠ 有**全局通配 alias**,不显式挡住厂商表会直接写进 live 记录。
  按坑 33 先查了格子——terminal 82.7 / deepswe 54.4 / toolathlon 70.3 / ale 25.2 **早就在**,
  而且来源就是这家自己更早的 model card,**逐位相同**。唯一真空位是 hle-tools(51.5),
  填它会改动已发布记录,这批刻意不做,留成一格的独立决定。
- `DeepSeek-V4-Pro (Preview)`:这**就是**目录记录现在装的那个模型,仍然不收。两个理由都是量出来的:
  `modelWindows` 的 validUntil 是 2026-08-12 而这些行带 08-13,alias 写了也是 inert;
  且这张表**改写了它自己 preview 的数** —— Toolathlon 55.9(目录 model-card 行是 51.8,
  官方板 55.86)、Terminal 72.1(归档里 AA 64.79/64.04、Vals 50.187)。厂商在后一篇发布里
  修订自己早先的数字,该带着日期躺在归档里,不该覆盖已发布格。
- `GLM-5.2` / `Kimi K3`:同样有全局通配 alias,这两条 null 是**承重的**,不是装饰。

**脚本改动只有两个可选字段**(`adoption` / `rowNote`),让 meta 与行的模板不必对自己的批次
说假话——这批的表不是客户端渲染的、厂商也**罕见地给了 harness 与 effort**(Note 1:DeepSeek Harness
minimal mode + `max` effort),而模板原本每行都硬写「未标注 harness、reasoning effort」。
按脚本自己的保证做了回归:重跑 qwen3.8 与 glm52,jsonl **逐字节相同**,两个 meta 除 `retrievedDate`
外 note 一字未变(retrievedDate 已还原)。

**契约**:ingest(生成文件零变化)· lint · check:data(29 models / 2170 obs / **1401-2088 · 67.1%**,
与改前一致)· check:models(322/324 backed)· build · check:beian(4 routes)· 归属回测
(331 条人工判断,0 contradicted;trap set 21 条 0 误映)· 三个 self-test(evidence / aa / archive)·
两个通知侧 self-test 全绿。`check:prices` 红 = pro 那一条,与 `main` 上完全相同。
`describe-change` 报 **0 models / 0 moved**。
未在本机跑 `check:mobile`:这次没有动任何 UI 或生成数据,CI 会替它跑两条路由。

**并发**:本轮全程另一个 session 在同一棵工作树上做 `/persona` 的生产发布并往 `main` 推 commit。
按纪律没有动那棵树 —— 改动全部在 `git worktree` 出来的独立工作区里做(`node_modules` 用
`cp -Rl` 硬链过去,748M 只花 14 秒;⚠ 软链会让 Turbopack 报
`Symlink … points out of the filesystem root` 直接 build 失败)。

## [2026-08-17] main 变红的推送改成按「红的集合变化」触发,并把 #93 / #94 合了 `#ops` `#notify`

**owner 的话是「pushplus 一直说 main 检查是红的」。** 先量:今天 `main` 上跑了 **8 次 CI、8 次红**,
红的**都是同一条**(pro 那个价格 term,owner 自己裁决保留的红),8 次里大多数来自另一个 session
在快速推 persona 的 commit。⇒ 推送频率跟着**「有人在推代码」**走,而不是跟着**「出了什么事」**走。

这与 8-06 那次十砍四是同一个病从另一头来:那次砍的是「唯一可能的回应是『嗯我看到了』」的通知,
这次是**同一个回应重复八遍**。机制上,`if: failure()` 的粒度是一次 job 失败,而一个持续存在的
已知红,它承载的信息量在第二次就是零了。

**改法**:`scripts/notify-main-red.mjs` 比对**失败步骤的集合** —— 与 main 上一次已完成的 push run
不同才推,相同则每个 UTC 日最多提醒一次;顺带把红的步骤名**写进消息**(旧的只说「去 run 里看」)。
今天那 8 次按新规则是 **2 次**。**不存任何状态**:每次从 run history 现推,没有缓存会 stale,
重跑一个旧 commit 也污染不了「上次看到的」。

⭐ **承重的是「读不出来怎么办」**:当前 run 读不到、没有上一次、上一次读不到 —— 三种未知**全部推**。
29 与 34 两次失灵的形态都是「检查够不到它的对象,于是什么都没说」,所以未知这一支故意吵。
同理 job 声明了 `actions: read`:少了它 run-history 读 403,退化成**每次都推** = 旧行为,
是安全的那个方向失败。⚠ 沉默从此表示**没变**,不表示绿了,这句话写进了消息正文。

**self-test 有解释力,不是摆设**:9 条决策断言 + 一条重放今天真实时间线(8 次推 → 断言只出 2 次)。
把「未知当成安静」这条退化塞回去,对应那条当场转红。已进 CI(`Replay the red-on-change rule
against the day that produced it`)。

**同一轮把两个 PR 合了**,合之前都在本地把结果验过而不是只看 CI:
- **#93**(OpenAI 降价,batch 34):本地 test-merge 干净,合并后 `check:price-drift` 从「terra +25% /
  luna +400% 未解释」变成「28 条全部落在 10% 以内」—— 这正是它要修的。
- **#94**(batch 35 + 退休 flash term):在 #93 之上重新 rebase 并复跑全套,`describe-change` 仍是
  0 models 0 moved。
两次都核对了 PR head SHA 与本地 HEAD 一致再合。⚠ GitHub 当时在 major outage,`gh pr create` 走
GraphQL 连吃两个 503;改走 REST(`gh api … /pulls -X POST`)建的 #94,建之前先查了一次开着的 PR
列表确认没有建重。

**`main` 仍然是红的,而且仍然是故意的** —— pro 那条要等身份翻转(36/49)。这次改的是**报警的单位**,
不是那个红。

**同日后续 —— 上面那条修复自己上线当天就出了一个 bug,一小时内改掉(→ `GOTCHAS.md` 39)。**
步骤是 `node scripts/notify-main-red.mjs > main-red.md` + `[ -s main-red.md ] || exit 0`,而脚本用
`console.log` 打了一行诊断 `main-red notification: silent — …`。于是**安静那一支的 stdout 非空**,
文件非空,照推 —— 改完之后 main 上的**第一个**红,owner 手机收到的是
「一条宣布自己保持沉默的报警」。判定逻辑一个字没错,错在 I/O 契约:
**stdout 一旦被当作载荷,它就只能装载荷**,诊断全部改走 `console.error`(Actions 日志照样看得见)。
把正文抽成纯函数 `messageFor()` 并补三条断言(安静 ⇒ 空串 · 推送 ⇒ 正文含步骤名 · 正文不含任何
诊断字样),再用真实 API 复跑一次安静场景确认 **stdout 0 字节**。
⚠ 顺带发现第二件:那条 self-test 步骤排在 `check:prices` **后面**,而它正红着 ⇒ 这条断言从 8-16 起
**一次都没在 CI 里跑过**。守「job 失败时才触发的报警」的断言必须 `if: always()`,否则它只在报警
用不上的那种情况下才运行 —— 坑 37 那句「一个红把另一个红挡住了」的第二个受害者。
同一件事的更大后果记在这里:**pro 红着的这段时间,CI 24 步里只有前 9 步真的在跑**。

**收尾清账(同日)**:`TODO.md` 里那句「30 个批次里 16 个可脚本重读」是 8-10 的数,今天 CHECKPOINT
已按实测改成 33 / 20,两处同一事实必然漂 —— 删掉 TODO 里的副本,改成指向 CHECKPOINT 那一行和它的
复算命令;「没有路被推翻九次」同理改成指向 `GOTCHAS.md` 36(今天是第十次)。
另把「红着时 CI 只跑前 9 步要不要重排」立成一条待决 —— 今天只处理了守报警那一条(`if: always()`),
其余步骤怎么办是改 CI 语义的独立活,不顺手做。

## [2026-08-19] 把「GA 停涨」重测了一遍:互锁的因果说反了、AA 那 34 行是 preview、地板不是翻转的闸门 `#measure` `#incident` `#decision`

接的是 8-18 与 8-19 两班的结论。**三条都不成立或不精确,而且三条都会让下一班做错事** ——
所以本条以实测为主,决定留给 owner。

**① 「36 格的供给被 pro term 卡停,所以读数不会再自己涨」——因果说反了** `#measure`
互锁的**机制**是真的(refresh job 的 `Run the contract` 跑 `check:prices`,红 ⇒
`Commit a tier-A refresh straight to main` 被 skip;`fetch-source.mjs --live` 每早照抓、
随后 `git checkout -- .` 丢掉)。但**结论**错:每天的 `drift` job 是**独立 job**,它照常读上游,
所以「上游有没有 V4 Pro 的新行」这个问题今天就能回答。
2026-08-19 实测(复算 = `FETCH_TIMEOUT_MS=60000 npm run check:upstream`,exit 0,`ARCHIVE_STALE=1`):
**待入档 152 格**,分布 LiveBench 46 · Epoch 34 · GDPval-AA 36 · Vals 27 · FrontierMath 6 ·
LMArena 2 · ALE 1;**其中 V4 Pro 一格都没有**(`grep -Ein 'v4.{0,2}pro'` 全日志零命中,
而同一份日志里 `deepseek-v4-flash-0731` 的 ARC 三行是命中的 ⇒ 不是 pattern 假阴性)。
⇒ **今天就把 refresh 放开,GA 也是 36,一格不动。** 36 是「`-0813` 在活板上目前只发了这么多」,
不是「刷新被扣着」。⚠ 这条只对**今天这一次读**成立,措辞不要冻成永久结论。

**② 「约 46 行 AA 数据跨 4 种拼写躺在 archive 等 GA 记录」——是 preview,拿它建 GA 记录正是坑 24 那场事故** `#incident`
实测 AA 相关行 **34** 行(不是 46),4 种拼写。其中 **33 行是 preview**:
- 28 行的 note 里写着 AA 自己的**模型发布日 2026-04-24**(batch-26 的 25 行 + batch-14 的 3 行),
  那正是 preview 的 `created`;
- 数值也对得上厂商 Preview 列而不是 GA 列:AA `reasoning max` 的 `hle-no-tools` **37.5**,
  厂商 Preview **37.7**、GA **42.7**;`terminal` 2.1 AA **64.04**,Preview **72.1**、GA **87.9**。
  按坑 24 判据 1(数字差 2–5×)这是 preview,没有二义。
- 唯一一行 GA 是 GDPval-AA 板上的 `DeepSeek V4 Pro 0813 (Reasoning, Max Effort)`,
  而**它一格都不算** —— 坑 18 那个逗号:余项 `reasoning,maxeffort` 挡住 effort 剥离 ⇒
  证据计数器看不见它。(顺带:GDPval-AA **同时**印 0813 与裸串两种行 ⇒ 它是坑 24 判据 2 里
  「会分列的源」,所以它的裸串**就是** preview。)
⇒ 把这 34 行挂到一条 GA 记录上,等于把 preview 的分发布成 GA 的分 —— batch-31 的
`modelIdentityWarning` 早把这句写下来了。**下一班别照 PR #98 body 里那句去建记录。**

**③ 地板 49 是给「新增一条记录」用的,不能拿来卡「同一条记录换身份」** `#measure`
`dilutionFloor` 的 docstring 自己说的:*the number of filled cells a NEW model must bring* ——
推导前提是 `models + 1`,分母涨一整列。**原地翻转不涨模型数**,那套算术根本不适用。
⇒ 所以 TODO 那句「等 GA 读数够到地板再翻转」是拿**新记录的尺子**量**再识别**,
它永远满足不了(GA 36 < 49,而 ① 说 36 不会自己涨),这才是这件事卡住三天的真原因。
两条路都实测过代价(复算 = `.scratch/board.mjs` 那种数法:`OBSERVATIONS_BY_CELL` 逐记录数格):
- **原地翻转成 GA**(Flash 形状,29 个模型):preview 的 **58** 格退出、GA 的 36 格进来 ⇒
  **1379 / 2088 = 66.0%**,比今天的 67.1% 掉 **1.1pp**。地板不参与。
- **另立一条 GA 记录**(Qwen3.6 Max Preview 形状,30 个模型):**1437 / 2160 = 66.5%**,掉 **0.6pp**。
  ⚠ 覆盖率掉得反而**少**,但**这一条才是地板管的**,而地板说不行(36 < 49)。
⇒ 真正要 owner 定的是身份题,不是等一个数:**这条记录是不是那个在服役的模型**。

**④ 价格 term 不可能被一次 tier-A refresh 改变,所以它挡住 refresh 是一条假依赖** `#measure`
`check-price-terms.mjs` 只读两样东西:meta 里手写的 `priceTerms`,和 `app/model-data.ts` 里手写的
`MODELS[].price`。`grep -rn 'priceTerms' scripts/ .github/` 只有**三个读者**(price-drift、
model-provenance、它自己的 test),**没有任何写者** ⇒ 抓一遍活板不可能改动它的判定。
而 `upstream.yml` 自己在两处写着相反的原则(`check:price-drift` 与 `check:deployment` 都是
**只报不失败**,理由原文:*a price the vendor moved is a fact somebody needs, not a reason to
abandon the archive refresh*)—— `check:prices` 在 refresh job 里是这条原则的例外,而且是
唯一让「保留一个红」的代价变成**全目录停止采集**的那个例外。
⚠ 代价不只是 152 格:TODO 里等着看的两件(归属闸门接 `deepseek-v4-flash-0731`、
`--any-open` 第一次生效)也一并停摆,而 `deepseek-v4-flash-0731` 的 ARC 三行今天就在待入档里。
⇒ 立成待决(不顺手改 CI 语义):**refresh 的 contract 要不要把 `check:prices` 降成只报**
(`ci.yml` 上仍然硬红)。

**本班没动数据、没动 CI。** 改的只有四件套里的记录:上面三条纠正 + `GOTCHAS.md` 40 / 41。

**同日后续 —— owner 裁决下来,上面那句「本班没动 CI」作废。** 两件都定了:
① **记录身份 = 原地翻转成 GA**(Flash 形状,29 个模型,66.0%);
② **refresh 的 contract 把 `check:prices` 降成只报**,`ci.yml` 仍然硬红。

②**已改**(`upstream.yml` 的 `Run the contract`:`|| echo "::warning::…"`)。选择不对称的理由写进
步骤注释:这个检查的两个输入都是手写的、**零个写者**,而 tier-A refresh 的 footprint 只有
`data/sources/` 的行加生成产物 ⇒ 它**不可能**改变判定,那么拿它拦入档就是**为一件档案没造成的事
惩罚档案**。硬红留在 `ci.yml`,因为那才是「站上正在报什么价」该喊的地方。
⚠ 量过之后没有一刀切:`check:prices` 一共三个闸门调用点,**只降了 refresh 这一个**。
`attribute-and-merge.sh` 同样是假依赖(只写别名),但它挡的是自动写别名、风险面更大,立成待决;
`add-model-and-merge.sh` **该留着硬闸** —— 它写 `app/model-data.ts`,那正是 `check:prices`
的输入之一,新记录的 id 撞上一条 term 的 `modelId` 就会开始被比较,**它真的能改变判定**。
⇒ 一般化:**「这是假依赖」是逐个调用点的结论,不是关于这个检查的结论** —— 同一个 `npm run` 在
不同 footprint 底下,有的够不到、有的够得到(同族:坑 21 那句「grep 哪条检查真的够得到它」)。

## [2026-08-19 第二轮] 裁决落地:`deepseek-v4-pro` 原地翻转成 GA,守卫从日期换成串 `#decision` `#ship` `#measure` `#incident`

裁决 = **原地翻转**(Flash 形状,29 个模型)。上面第一轮的三条实测就是它的依据,这里只记**做的时候
才知道的事** —— 有四件,其中两件是差点做错的。

**① 差点把窗口反过来写,那会静默删掉 GA 自己的 23 格** `#incident`
`TODO` 原本写「撤 `modelWindows`」,而更"稳"的做法看起来是把 `validUntil: 2026-08-12` 反过来写成
`validFrom: 2026-08-12`(拒收 GA 之前的行)。⚠ **实测这会删掉 23 格**:LiveBench 把两个 release
**印在同一个冻结发布日下面** —— 裸串 23 行 + `-0813` 23 行,`evaluation_date` **全是 2026-06-25**,
早于 GA 上线三个月。窗口按 `modelId` 键、按日期比,**分不出这两拨**。
⇒ 守卫**换种类**:十个裸串写成**全局** `modelId: null`(带理由),`-0813` 串写显式 alias。
两个**不分列**的源走 file-scoped,判据写进 reason:DeepSWE 那行 62.8(厂商 GA 表 62.7 / preview 12.8,
判据 1)· 定价页自己的 MODEL VERSION 行印着 `DeepSeek-V4-Pro-0813`(判据 2)。
`archive.mjs --self-test` 从 5 条变成 **20 条**,第一条就是这个陷阱。⇒ 坑 **42**。
⚠ 窗口机制**留着**(`modelWindows` 现在是空数组):下一个源不分列的家族只剩日期这一个把手。
它靠一个**合成 config** 继续被跑到。

**② 「全局拒收」是这个仓库的新形状,顺出两个够不到的地方** `#incident`
以前 `modelId: null` **只有 file-scoped** 用过(厂商发布表里的竞品列)。全局拒收一上,两处露馅:
- `isRefused()` 第一行就是 `if (!file) return false` ⇒ 132 行 preview 会永久出现在 gaps issue 的
  「Archived rows waiting on a catalog model」里 —— 正是那个 file-scoped 分支写下来要防的
  「永久的、没法动手的一行」,从另一个门进来。已扩成两个 scope。
- **证据计数器把 11 格 preview 的格子记在 GA 记录名下**(frontierswe / critpt / ale / hle-no-tools /
  scicode / aa-lcr / tau3-banking / ifbench / frontiermath ×2 / toolathlon),self-test 当场红。
  ⚠ 备选是**给它挂 11 格 pin**,我没这么做:那等于**在这条记录三分之一的面积上把 over-count 闸门
  关掉**,去藏一个两个文件之外就有机器可读答案的事实。改成让计数器认**全局**拒收(file-scoped 的
  不认 —— 那只是说「不从这个源」,而这个计数器没有源这一维)。mean recovery 70% → **68%**(地板 60)。
  ⚠ 副作用记着:这条记录自己的 recovery 变成 **0%**,因为 self-test 拿 `[model.id, model.name]`
  当 needle,而它俩现在都是被拒的串。**这是真的**,不是 bug:这条记录的证据发在另一个串上。

**③ `PROVIDER_LOOKUPS` 那一行是承重的,契约全绿也发现不了** `#incident`
翻完九项全绿,`report:gaps` 却把 **`deepseek/deepseek-v4-pro-0813` 报成「目录没有的上游模型」**,
还列了 23 格「它能填」—— 那 23 格已经在看板上,headline 13 变 14。
机制:gaps 的「已有」过滤器 = `PROVIDER_LOOKUPS` 的值 + 各记录 `id`,用 `sameFamily` 比,而
`sameFamily` **不把日期后缀当 operating point**(对的,后缀常是另一个模型)。改法一行:
lookup 指向 `-0813`(**Flash 早就是这个形状,就在上面一行**)。同一行还喂着实时价格对比 ⇒
指着 preview 就是拿 GA 的 $1.32/$3.96 去对四月的价。⇒ 坑 **43**。
⇒⇒ 动一条记录的身份,要把**「谁按 id 认这条记录」全找出来**:lookup、alias、计数器的 needle。

**④ 两条 price term 同一次全退休 ⇒ 那个「拒绝空过」的测试红了,这是它在工作** `#incident`
`check-scheduled-prices.test.mjs` 断言至少有一条 live scheduled term,「否则这个测试是空过的」。
⇒ **没改成 skip、也没放宽**(那正好把「看起来在跑其实没跑」请回来):给 `check-price-terms.mjs`
加了 `--source-dir`,测试造一个**临时 fixture 目录**放一条合成 term,真实 term 有就一起断言,
没有就打一行 note 说明这次只跑了合成的。⚠ 合成 term 的 `listPrice` **从目录当前价读**,不手打 ——
所以「改价前一天是绿的」是因为目录**真的**在报 list price。这是同族第三个实例(窗口机制、
白名单空过),所以立成坑 **44**。

**实测后果**(复算写在 CHECKPOINT 现状表与各命令里) `#measure`
- **58 格 → 38 格,看板 1401 → 1381,67.1% → 66.1%**;vendor 源 200 → 189(四月 model card 那 11 格
  seed 删掉了,是**删除不是改标签** —— 它们是 preview 的卡)。`deepseek()` helper 一起删,防回填。
- **逐行核过没有第二个模型动过一格**:71 行 preview 出、35 行 GA 进(1992 → 1956 ingested)。
  ⚠ `git diff app/observations.generated.ts` 看着**满屏每个模型都在动** —— 那是 300 行分块重编号
  (坑 14 的邻居)。按 `(modelId, benchmarkId, version, score, sourceId, effort, harness)` 建集合相减
  才是真答案:非 V4 Pro 的变化 **0 行**。⇒ **看 diff 的形状会得出相反结论,要按内容比。**
- **四个操作参数全成 null**:AA 还没发 GA(34 行里 33 行写着它自己的发布日 2026-04-24)。
  编造是唯一的备选,没做。价格例外,因为厂商自己的页面点名了 release。
- 记录现在**一行 vendor 的数都没有**:38 格全来自 LiveBench / Vals / DeepSWE / GDPval-AA。
- `check:prices` **转绿**,batch-31 的 pro term 进 `retiredTerms`。

**没做的**:batch 35(DeepSeek 自己的 GA 表)**仍然一列不采**。旧理由(目录没有 GA 记录)已不成立,
新理由是**要先裁跨源分歧**:`terminal` 厂商 87.9 vs Vals 的 GA 54.7,**差 61%**,跨源闸门按设计会红,
裁它是「厂商 vs 独立源在系统类基准上的脚手架差异」这种编辑判断(规则 6)。裁了之后真正新增 **3 格**。
立成 `TODO.md` 一条待决,**没顺手塞进身份改动里**。

## [2026-08-19 第三轮] 采纳 batch 35 的 GA 列:四格新增、零个已发布数字被改,顺出闸门的两个真相 `#decision` `#ship` `#measure` `#incident`

裁决 = **采**。做之前先把「采纳的代价」量清楚,量出来的结论**比我上一轮写的更轻**:
上一轮我把这件事描述成「要先裁一条会让 `check:data` 变红的跨源分歧」——**红不了**,原因见 ②。

**① 采纳不改任何已发布数字,因为 `SOURCE_RANK` 把 vendor 排在最后** `#measure`
`app/model-data.ts` 的 `SOURCE_RANK = { benchmark: 0, independent: 1, vendor: 2 }`,格子内按它排序、
第一行当 primary。所以采纳后:`terminal` 仍显示 Vals 的 **54.682**(厂商 87.9 当第二读数)、
`deepswe` 仍显示 DeepSWE 自己的 **62.8**(厂商 62.7 当第二读数);真正**新增**的是目录本来空着的四格
—— hle-no-tools 42.7 · hle-tools 60.0 · toolathlon 74.1 · ale 25.7。
`describe-change` 原话:「没有任何已有模型的数字被改动」。**38 → 42 格,1381 → 1385,66.1% → 66.3%**。
⇒ 教训:**「采一列厂商数」的风险大小取决于那些格子空不空**,不取决于厂商数偏高多少。
先查 primary 规则再估代价,别凭「厂商数会覆盖」这种直觉。

**② 那条 61% 的分歧闸门**根本**不会响** —— 而这是设计,不是漏洞 `#incident` `#measure`
`check-model-data.mjs` 把格子里的行按 `${harness}|${reasoningEffort}` **分桶**,只在桶内比 >20%。
厂商行按约定 harness / effort 都留空(`-|-`),Vals 的 GA 行写着 `-|max` ⇒ **两个桶,永不相遇**。
⚠ 我一开始想「那就把 Note 1 的 harness/effort 补到行上,让它们进同一个桶」——**没做**,两个理由:
一是厂商 Note 1 说的是「code-agent 任务」而没说哪几行,摊到行上是判断不是抄录(批次 meta 早写了);
二是**补了 harness 反而更不会响**(桶变成 `DeepSeek Harness|max` vs `-|max`,还是两个桶)。
⇒ 于是量了一下分桶到底对不对:全目录 **113** 个格子存在 >20% 的跨行差而闸门刻意不比
(绝大多数是 effort 阶梯,同一模型 low 档 7.2 / max 档 39.5,比了纯噪音),闸门真会响的只有 **1** 个。
**放宽分桶 = 113 条假警报,通道当天就废。** ⇒ 分桶是对的,结论是:
**采厂商列之前必须自己逐格比一遍**,分歧写进 `acknowledgedDisagreements` —— 那条文字
**就是唯一的记录**,闸门永远不会触发它。⛔ 别把沉默读成一致。⇒ 坑 **45**。

**③ 裁决本身:两个读数都留,独立源当 primary,但「厂商偏高」解释不了这个量级** `#decision`
写进 `acknowledgedDisagreements` 的四条实测(全文在那条 reason 里,**这里不复述**):
- 规则 6 + 脚手架**不对称有据**:厂商在表下 Note 1 里点名了自己的 scaffold(DeepSeek Harness
  minimal mode、max effort、temp 1.0 / top_p 0.95),Vals 这一行**没写 harness**(它在别的行会写
  Claude Code / Codex / Cursor CLI)。
- **量级不合分布**:同一列上「同模型 厂商−Vals」实测 n=12,Δ 从 **+2.04**(gemini-3.5-flash)
  到 **+19.18**(qwen3.8-max),均值 +8.5;这一条是 **+33.22**,比历史最大值还高 14 分。
  §9 记的方向是 Terminal-Bench 上厂商最多高 +8 —— 这是四倍。**所以「厂商偏高」只解释了一部分,尾巴没解释。**
- **Vals 自己那一读也怪**(这半是读者不会想到去查的):同一块 Vals 板上,同一个 GA 条目
  SWE-bench Verified **96.4**、LiveCodeBench **87.5**(全目录 Vals 给出的最强 coding 数),
  而它的 Terminal-Bench **54.682** 比 Vals 自己给 inkling-small(55.056)和 qwen3.6-plus(53.184)
  的还低。一个模型不会既领跑 SWE-bench Verified 又在 Terminal-Bench 上落后小模型。
- **两边都没有第三方佐证**:这一格**没有 benchmark-native 读数** —— Terminal-Bench 自己的板没发 GA,
  AA 也没发(它 34 行里 33 行还写着 2026-04-24)。**分歧发生在两个最弱的源类之间,最强的那类缺席。**
⇒ 退休条件写进条目:等第三个读数,它站哪边就是答案。

**④ HLE 那一行的拆分做进了脚本,不是手工补行** `#ship` `#incident`
TODO 原话是「采纳那天要把 with-tools 那个数拆成第二行」。⚠ 照字面手工往 `.jsonl` 补 8 行会被
**下一次 `capture:release` 抹掉** —— `capture-release-tables.mjs` 对 `.jsonl` 和 `.meta.json` 都是
`writeFileSync` 覆盖写,而且**没有任何检查会发现归档与脚本脱钩**(契约只查「生成产物 vs 归档一致」)。
⇒ 改成给 `carried` 加一个 `dualColumn` 字段(一行published → 两个目录列),然后**重跑 capture**。
重跑结果就是可复现性的证明:原有 76 行**分数零变化、非 note 字段零变化、零删除**,只多 8 行。
⚠ 拆出来的数**交叉验证过两处**,没信「脚本跑出来就对」:`DeepSeek-V4-Pro (Preview)` 的 hle-tools
出来 **48.2**,与四月 model card 在目录里挂了三个月的那格逐位相同;`DeepSeek-V4-Flash-0731` 出来
**51.5**,与 alias 里早就写下的数逐位相同。⇒ 坑 **46**。
⚠ 顺带:Flash 那一列现在**真的有 hle-tools 行了**(以前只是 note 里的散文),所以 batch 35 里
Flash 的 file-scoped 拒收比以前更承重 —— 它挡的不再是「一个数字的说法」,而是一行能直接进库的行。
alias 的 reason 已按此改写。

## [2026-08-20] 连红两天的 refresh:上游把同一条测量发了两遍,闸门丢的是**整批** `#incident` `#ship` `#measure` `#decision`

- **症状与代价**:08-19、08-20 两次 06:00 UTC 的 daily refresh 连续红,**152 格待入档在七个源上积压**,
  每天早上被重读一遍再整批扔掉。看板本身一切正常 —— 这是它两天没人发现的原因。
- **根因不是上游漂移,是重复发布**。Epoch 的 `benchmark_data.zip` 把同一条测量发了两次:
  ARC Prize CSV 里**同一个 Airtable 记录**以仅大小写不同的显示名出现两次;`apex_agents` 里同一个 run
  一次以纯 slug、一次把 effort 放进显示名,`splitEffort` 又把它折叠回同一个操作点。两者解析成
  **字节级相同**的观测行 ⇒ `scripts/check-model-data.mjs:79` 的 duplicate-configuration 闸门红 ⇒
  **整个批次不入库**。闸门做的是对的事;代价是**批次级**的 —— 一个源的重复发布扣住了**所有源**的入档。
- **修法(PR #102,tier-B 三条件自合,`e37255b`)**:`scripts/fetchers/epoch.mjs` 在 fetch 时折叠
  **字节级相同**的行(实测当天 683 → 669,14 条重复)。
- ⭐ **故意不做的事**:导出里还有 8 个「同配置、不同分数」的格子(如 `claude-opus-5`/ARC-AGI-2
  90.42 vs 88.33,多为精度变体)。**那是板在动,不是重复发布**,静默挑一个正是这个项目要防的失败
  ⇒ 全部按原样保留。闸门对它们也不误伤:它的 key 里**含 `score` 和 effort**
  (`check-model-data.mjs:65-75`),所以「same configuration」这个名字其实抓的是**完全相同的观测**,
  不是「同一配置的两个读数」—— 这两件事在这个仓库里必须分开,机制进 `GOTCHAS.md` **47**。
- **验证**:合并前做完整彩排 —— 本地全源 `--live` 刷新 + 六项契约全绿,两行「被删」diff 证明只是
  位置平移、没有丢行。合并后手动 dispatch `upstream.yml`(本来要等明早 06:00),全绿,
  refresh 走 tier A 直推 main(`5849fa6`,18 个文件全是 `data/sources/` 与生成产物)。
- **实测结果**(2026-08-20,复算 = `npm run check:data` 末行 / `npm run check:models` 末行):
  coverage **66.3% → 66.6%**(1385 → **1390** cells / 2088)· observations 2129 → **2155** ·
  源分类 benchmark **921** / independent **1039** / vendor 195 · 溯源 317/320 → **319/322**。
  其中 Epoch 自板重打分带来 2 个**下修**(DeepSeek V4 Pro GPQA 92.424 → 91.67、
  Inkling Small 89.5 → 88.51,走 tier A 正常通道),4 个 ARC-AGI-2 格子拿到独立佐证。
- **顺带关掉的观察点**:`deepseek-v4-flash` 的三格 ARC-AGI-2 现在由两源各写一行
  (arcprize 8-14 benchmark 行 + Epoch 8-20 independent 行)。但它们是**走已有 alias** 解析的
  (`data/model-aliases.json` 里 `-0731` 三条裸串条目),**归属闸门今天没有提出任何新 alias**
  ⇒ 「看它到底自合了还是留 PR」这个观察点**今天没有发生**,不是发生了并通过。`--any-open` 同理。
- **没动的**:PR #98(GLM-5.3 发布表,只收证据零采纳,等 owner 决策)· PR #77(Action 的 AA 参数刷新分支)
  —— 都不是排程 agent 该合的。无服务器遗留,分支已删。
- **收工顺手做的轮转**:`LOG.md` 涨到 907 行(超过 ~600 的阈值),把 2026-08-12 第二轮 ~ 08-15 收尾
  共 **10 条**整体移进 `LOG-archive/LOG-2026-08.md`(41 → 51 条);live 文件 19 → 9 条 / 453 行,
  标题起点改成 **2026-08-17 起**。顺手删掉 live 头部那句会漂的行数快照、以及档案头里 pin 的轮转日期
  —— 轮转事件的唯一真相是这条 LOG,不该在文件头留第二份。
- **同日追加(#77 合并)**:AA 参数重读带来六个「目录 vs 归档」硬矛盾,按 AA 走。
  判据不是「谁更旧」而是「目录的据没了」—— `batch-14-aa-parameters.jsonl` 是**整文件覆盖生成**的
  (596 → 610 行),AA 一重读,目录原来引的那几行就不在档案里了。
  `qwen3.8-max` 速度 81.57 → 44.5(−45%)不是档位串:同一行里 intelligence 58.1、costTask 1.132、
  输入输出价**全没动**,跟着一起动的是 AA 自己的端到端中位数 **33.46s → 58.82s** —— 两个字段同向
  互证,是一次自洽重测。站上影响实测很小:Best value 卡片不变(DeepSeek V4 Flash 0731,ratio 1666.7,
  第二名 1110.4),只有 `glm-5.2` 性价比 7 → 11、`gemini-3.6-flash` 13 → 9(共 23)。
  ⚠ `check-model-provenance.mjs:110` 的 `close()` 是**绝对容差 0.005**,所以 `qwen3.7-plus`
  56.59 vs 56.58 也算硬矛盾 ⇒ **每次 AA 刷新都会重演这一幕**,这是 TODO 里「价格/参数要不要走 ingest
  派生」那条的实证支持。路上踩到坑 **48**(注释写进记录里 ⇒ 分类器报「记录被移除」)。

## [2026-08-26] 仓库改名 `quarkspace`,并修掉指反了三天的真相源 `#decision` `#ship` `#measure` `#incident`

**起因是一句话。** 有人问「quark space 现在是不是没用了,现在都是 ai observatory 什么的」——
名字在替代码回答问题,而且答错了。真正名不副实的是**这个仓库**:它装的是整个站
(个人站 `/` · 观测台 `/models` · Persona Lab `/persona`),`ai-model-observatory` 只描述了一个路由。

### 先修的:一个事实四份副本,两份指反

`../quark-space` 在 **2026-08-23** 已被它自己新增的 `content/CANONICAL_SOURCE.md` 降级为设计存档。
但同一个事实还有两份没跟上、而且**方向是反的**:本仓库 `AGENTS.md` 写着「更完整的真相源在
`../quark-space/content/projects.json`」,`README.md` 目录说明里同一句反话。quark-space 那边同样两处:
`CHECKPOINT.md`(新 session 的入口)的「链接」一节,和 `projects.json` **自己的 `_about` 字段**
(「正式站点从这个文件构建」——这句在文件内部,谁打开谁被误导)。

- ⚠ **`AGENTS.md` 不是普通文档,它是操作合同**。每天 10:30 UK 的 hermes 班和任何动首页的 agent
  都先读它。指反了的后果不是文档不好看,是下一个执行者会照着一份**冻结快照**去改线上文案。
- ⚠ **实测:本仓库 30 个 npm script 里没有一个校验散文** ⇒ 没有任何自动闸门够得到这件事。
  它错了三天,零告警。
- ⇒ 修完后又收到一条更准的意见,**又改了一次**:第一版把 `home-content.ts` 笼统写成
  "source of truth",这会把权威从一处漂到另一处。正解是**分两层**:职业事实与定位的上游是
  `JobFinder/00_总控/`,`home-content.ts` 只是**已部署首页的实现权威**(说什么、放哪些项目、什么顺序)。
  混为一谈正是上一次漂移的起点。(#115)

### 改名:三个名字**故意**不一致

| 层 | 值 | 动了吗 |
|---|---|---|
| GitHub repo slug | `Quarkgluonmixture/quarkspace` | ✅ |
| 本机文件夹(Mac) | `~/Documents/Promptfoo/ai-model-observatory` | ⛔ 故意不动 |
| 本机文件夹(Windows / hermes) | `C:\Users\Administrator\Projects\ai-model-observatory` | ⛔ 故意不动 |
| EdgeOne 项目名称 | `ai-model-observatory` | ⛔ 不是我们的 |

**只改 GitHub identity、不动文件系统路径与 scheduler cwd**,是风险最小的做法 —— 自动化最怕的是
为了"整齐"同时动 repo slug + 本地 path + scheduler cwd。⚠ 这三个名字现在长得不一样是**设计**,
不是遗漏,⛔ 别顺手改统一(细节与两条不可逆事实在 `GOTCHAS.md` **49**)。

**改名前实测过的**(所以敢动):全仓库**零处硬编码仓库 URL**;`scripts/check-heartbeat.mjs` 优先读
`GITHUB_REPOSITORY`、否则从 `git remote get-url origin` 推导 ⇒ 改完 remote 自动切过去。
hermes 侧同构:它的 cron job(canonical id `2d4dbdc7db6f`)配置里**没有** `--repo` flag,
workdir 直指本地 clone、prompt 全是相对命令 ⇒ 切 remote 就通,`jobs.json` 不用改。

**改名后实测**:`check:heartbeat --github` 从新 remote 推导出 `Quarkgluonmixture/quarkspace`
并查通 GitHub API;`check:deployment` 两次全绿(ICP 备案 3/3 host-route,`quarkspace.top`
服务内容与 `main` 一致,29 models × 72 benchmarks)。顺带清掉**第三个**历史名:
`package-lock.json` 的 root name 一直还是 `site-creator-vinext-starter`
—— 实测 `npm install --package-lock-only` **只改那 2 行、零依赖漂移**,所以并进改名而不是另开 commit。(#116)

### #decision 三条,理由记在这里

- **`quark-space/content/projects.json` 不搬进本仓库。** 它是 2026-08-03 的快照。搬进 live repo
  它就变成一个 `grep` 得到、看起来像数据源的文件 —— 正是 8-23 那条禁令要防的事。历史留在
  quark-space 的 git 里。同理那四张截图**字节级相同**于 `public/shots/`(`cmp` 过),搬 = 第三份副本。
- **封存 quark-space 放在整个流程最后**,而不是紧跟改名。旧仓库保持可写,是 EdgeOne 或 hermes
  出怪行为时唯一的退路。
- **个人站的待办迁进本仓库 `TODO.md`**(此前这里完全没有个人站那一节)。⚠ 迁移**不是照搬**:
  对着代码逐条验过,原本 7 条里 **5 条已经做掉了**,只剩 2 条。⇒ 教训是
  **搬待办前先验它还成不成立**,一份 8-11 的清单搬进 8-26 的仓库就是凭空造出五件不存在的活。

### ⚠ 一个假绿,当场记下来

改完之后跑 `check:heartbeat --agent`,它报「队列有人在做,最近一次非 bot commit 0.0 天前
(`62805ce`)」——**那是我们自己刚才的 commit**。这正是 §10 与 `TODO.md` 里那条已知缺陷:
你自己开一次 session 就把三天时钟清零。⇒ ⛔ 这条**不能**用来证明 hermes 还活着。
hermes 死掉仍然是这套系统里唯一背后没有推送的失败;那条「要不要给它推微信」的裁决,
今天变得更值钱了。

## [2026-08-31] batch-39 Kimi K3 落地:上一天被迭代上限截住的 commit,本班 rebase 后自合 #ship

**背景**:8-30 班把 Kimi K3 发布表做完全验完(7 新格 + 7 证据升级,契约全绿,describe-change
无已有数字改动),但被迭代上限截在 commit 之前,改动全留在工作区。本班(8-31)按显式路径
commit 后 rebase 到 origin/main —— 中间进了一个每日 live refresh(4dd8f55:Qwen3.7/3.6 Plus
FrontierMath 各 +1 格,Kimi K3 GDPval-AA 1668→1644,GPT-5.6 Luna / GLM-5.2 FrontierMath 下修,
23 条 grok-4.6 LiveBench withdrawn 行 acknowledged 保留)。

**为什么 rebase 后必须重验**:auto-merge 在 generated.ts 上无冲突,但无冲突 ≠ 语义正确 ——
两边都重新生成过这个文件。重跑 `npm run ingest` 后工作区 clean,证明合并语义与 fresh ingest
一致,这是唯一可靠的验法。⚠ 顺带发现 README 覆盖计数被 live refresh 顶旧了(我们 commit 的
2190/1397/66.9% vs fresh ingest 真值 2196/1399/67.0%),单独修了一笔。

**重验后 tier-B 三条件仍成立**(契约全绿含 disagreement/one-source-one-cell、describe-change
无已有数字改动、无新增 exemption),按 batch-38 先例 agent 直推 main。

**改动**:
- `scripts/capture-release-tables.mjs`:+`kimik3` entry,行生成器支持 `carried.harness` /
  `release.effort`(首个在脚注里声明 harness/effort 的发布表)。
- batch-39:251 行整表归档,只采纳自家列 13 标签(HLE-Full 一行拆两列)14 行;五个竞品列
  file-scoped 拒收;八个标签带理由拒收(六个 AA/官方榜转引、MCP-Atlas 500-task 子集、
  SWE-Marathon H20 校准分支)。
- 7 新格:hle-tools 56、FrontierSWE 81.2、PostTrainBench 36.6、BrowseComp 91.2、
  OSWorld 2.0 58.3、OmniDocBench 91.1、CharXiv 84.8。覆盖率 2196/1399/67.0%。

## [2026-09-04] AA 刷新改成自己对账、自己合;章程把「可以自合」改成「就该自合」 `#ship` `#decision` `#measure` `#ops`

**触发**:owner 一句「我总得手动合 PR,我不想看,我就想让他更新」。先盘了一遍最近的动作,
把「要人」的活分成三条独立的流,**它们的成因完全不同**,不能一刀切:

1. **`auto/refresh-aa`(每周 1 条,人合)** —— 真正的重复劳动。
2. **hermes 的 tier-B PR(#105 / #108 / #109,开了 10 天)** —— 与检查无关,是章程措辞。
3. **每日 `Upstream` 的 drift job 自 9-03 起红** —— tier-C,LiveBench 改写了冻结版本下的
   3 个 nemotron 格(issue #122)。真的要人定,**没动**。

### 1 · AA:那个「reviewer 的判断」其实已经被同一套论证做过两次

`#measure` 实测两次人工对账 commit,内容是同一件事:
- PR #114(9-01)14 条矛盾 → 目录抄归档值(+10 条 `supersededRows` 把 batch-08 的槽位路由到 14)。
- PR #121(9-04)20 条矛盾,**全是 speed/latency**,目录抄归档值,10 行 diff。
  commit message 的全部论证 = 「归档那边是今早脚本从源头重读的,所以目录是陈旧的那一边」。

那不是判断,对这两个字段它**按构造为真**:归档行是脚本几分钟前从源头写的,目录值是同一个脚本
更早一次运行的副本,没有第三种可能可权衡。⇒ 写进 `scripts/reconcile-aa.mjs`,不再每周重新论证一次。

- **只碰 `speed` / `latency`**。`intelligence` / `costTask` 同批次但**故意不收**:它们是给板子排序的
  合成值(intelligence 直接决定读者看到的顺序),8-12 那次整批移动的正解是一个**路由决定**
  (`supersededRows`,逐模型逐字段),要人做一次并写下来。脚本悄悄跟着它们走 = 没人决定却把站重排了。
- **一条不合就整个不写**(fail-closed)。理由二才是承重的:只要有一条没对上,`check:models` 照样红、
  PR 照样等人;写掉机械的那一半买不到任何东西,只会把真正要人看的那一半埋进 20 行 diff 里。
- 写法是**按 `cfg()` 参数位置**改单行,并且校验「文件里现在这个值 == 审计说它看到的值」,
  对不上就抛 —— 那说明审计和写者看的不是同一个东西,这时唯一正确的动作是停。
- 实测:把 sol/max 的 speed+latency 改回旧值 → 跑 `--write` → **与 PR #121 那次人工 commit
  逐字节一致**,`check:models` 回绿;再把 `intelligence` 也改一下 → **一个字都没写**,只报升级。

### 2 · hermes 那三条不是检查挡的,是**章程措辞**挡的

`#measure` 先去核了假设(原以为是 `check:prices` 红着的假依赖,**猜错了**):三条 PR 的 CI
**全是 success**。#109 的 body 自己写着:「改动本身够 Tier B 自合三条件,**但按章程默认开 PR**」。

⇒ 它对章程的理解是对的,**是章程错了**。「you **may** merge」被读成「默认开 PR」,于是一个
只有 owner 能排空的队列长了 10 天,而 owner 明确说过他不想当读的那个人。
⇒ 改成:四条全真 = **合并并删分支**,不是可选;有一条不真 = 留着并**点名是哪一条**(#108 做对了,
它点名了 18 个移动的数字)。并明确禁掉「和相关 PR 一起看」这条第五条件 —— 相关性不是闸门,
把能合的压在不能合的后面正是这 10 天的成因。

### 3 · 接闸门之前先量读数,救回一个「永远为假」的条件

`#incident` 差点写出一个静默失效的自合条件。`describe-change` 的 `moved` marker
**把目录数字也算进去**(故意的,历史理由在该文件头部),而 `auto/refresh-aa` 存在的目的就是改目录
speed/latency ⇒ `moved == 0` 在这条分支上 = 在问「我有没有干活」,干了就拒。
实测:只对账一个值就打印 `0 models, **1** moved`。
⛔ 没有去放宽 `moved` —— 归属闸门和新记录闸门读同一个 marker,在**那两条**分支上「目录数字动了」
正是该叫人的事件,放宽 = 在它们身上开洞。✅ 另起 `<!-- observation-cells-moved: N -->`
只数观测网格,一个 marker 一个问题。→ 坑 **50**。同一步还踩到 `{ … } | tee` 吞变量 → 坑 **51**。

### 落地清单

`scripts/reconcile-aa.mjs`(新,带 `--self-test`,已接 `ci.yml`)· `check-model-provenance.mjs --json`
(结构化矛盾,唯一读者是 reconciler,避免把审计的字段名抄成第二份)· `describe-change.mjs` 新 marker ·
`aa-refresh.yml`(对账 → 描述 → **契约变成闸**(`check:prices` 仍只报,理由同 8-19)→ 开 PR → 四条件自合)·
`open-aa-pr.sh`(commit 带上 `model-data.ts`;人已介入时向 workflow 报 `handsoff`)·
`AGENT-OPERATIONS.md`(硬规则 1 从三条变四条;tier-B 默认翻转)· `AGENTS.md` / `README.md` 同笔改
(那两处都写着「碰 `model-data.ts` 就要人」,现在有了一个窄例外,**不改就是让读者读到漂移的那份**)。

## [2026-09-04] 可用性有了自己的收件人;agent 的 liveness 变成可测 `#ship` `#measure` `#ops` `#incident`

同一天的第二轮。上一轮拆的是「要人合 PR」,这一轮拆的是**体检**里查出来的两个洞。

### 体检结论(31 天,8-05 → 9-04)

`#measure` 复算命令都在下面,数字是实测不是印象:

- **数据更新是全自动且真的在跑**:8-20 → 9-04 **连续 16 天**每天都有 `Refresh live boards` 自动提交。
  8-16~8-19 那 4 天断更是**已经修掉的旧事故**(价格 term 红着卡住刷新,8-19 降成只报)。
  复算 = `git log --format='%ad|%s' --date=short origin/main | grep 'Refresh live boards'`。
- **每日 job 红了 12 次,但红的全是 drift job,refresh job 12 次全绿** ⇒ 站上的数一天没受影响。
  复算 = 对每个 failure run 跑 `gh run view <id> --json jobs`。
- **72 列里 53 列每日自动重读**,5 列只有 AA 脚本(不每日),11 列只有手抄行,3 列无归档行。
  复算 = `npm run report:column-automation`。
- **部署每天被验证**:`check:deployment` 核 quarkspace.top 服务内容与 main 一致 + ICP 备案 3/3。

### 洞一:一个红扛两个语义(→ 坑 52)

12 次红只开出 **3 个** integrity issue ⇒ 约 9 次是「源读不出来」,只有 log 里一条 `::warning::`。
它借走了 job 的颜色,而那个颜色被 `check:heartbeat --github` 读、被 hermes 每天第一件事读。
⇒ `scripts/publish-availability-issue.sh`(新):issue 首次就开(记录),微信**连续两次**才推(报警),
streak 存在 issue body 的 HTML 注释里 —— 那是这个 job 唯一不用 commit 就能活到明天的状态。
源读通了就从 body 里删掉,所以 streak 是**真·连续**不是终身计数。
同时把 drift 步骤的判决改成**从 log 决定**:integrity 红 · availability 不红 ·
**既不是这个也不是那个的非零仍然红**(⛔ 不许吞掉自己不认识的失败)。

### 洞二:心跳读的身份和被监控者共用(→ 坑 53)

`#measure` `hermes-agent` 这个作者名在整个仓库历史里**只出现过一次**(2026-08-11,
而且干的正是今天被自动化掉的那件 AA 对账)。此后每一班都签成 owner ⇒
`check-heartbeat --agent` 永远分不清「hermes 跑了」和「owner 开了个 session」。
⇒ 修的是**身份**不是逻辑:章程加《Commit as yourself》,`--agent` 多打一行 agent 署名的 commit 距今多久,
**只报不失败**(身份配在本仓库看不见的机器上)。「hermes 死了要不要推微信」仍在 `TODO.md`,没动。

### 顺带查清的一件事:新模型**不会**自动进目录

`#measure` `#deadend` 被问到「新模型是不是自动加入、自动进榜和雷达图」,实测:

- **闸门每天跑,从来没触发过一次**。`auto/new-model` 分支**一个 PR 都没开过**,
  git log 里零条 "cleared the floor"。上一次加模型是 **2026-08-06,人工**。
- 原因是地板 = 现有模型的平均格数,今天 **49**(1402 格 / 29 模型)。而新模型天生格少:
  今天最好的候选 `x-ai/grok-4.6` 只有 **31** 格,`meta/muse-spark-1.2` 32 格,
  `z-ai/glm-5.3` 29 格 —— **结构性地永远够不到**。复算 = `npm run propose:model`。
- ⭐ 但**记录一旦存在,后面全自动**:alias 归属闸门每天跑;ingest 自动挂新行;
  排行与雷达图纯派生 —— 一个模型在某轴凑够该轴 core 基准的 **50%**(最少 2 个,
  `portfolioFloor` in `app/model-data.ts`)就自动出数,**没有第二个开关、没人给它配置**。
- ⚠ 自动写出来的记录 `tags: []`(无筛选 chip)、颜色自动挑、`open` 硬编码 `false`
  —— 若模型其实是开源权重,`check:models` 会红 ⇒ 闸门不自合、转 PR。fail-closed,是对的。
- ⇒ 这不是「自动化没做」,是 8-12 已定的收录门槛在起作用(放开会自我强化地塌:
  收 9 个 → 覆盖率 67.0% 掉到 53.5%)。真正的出路在 `TODO.md` 那条
  「把上游新模型那段改成『最新发布』看板」—— 覆盖率一个点都不掉,因为它们本来就不在分母里。

**从 CHECKPOINT 退役的两段(2026-09-04,快照满了)**:个人站 `/` 的待办 8-26 从 quark-space 迁进本仓
`TODO.md`,迁移时逐条验过 —— 原本 7 条**只剩 2 条**成立,⇒ **搬待办前先验它还成不成立**。
8-19 那一整轮(`deepseek-v4-pro` 原地翻转成 GA、守卫从日期换成串、batch 35 的 GA 列采纳)
已全部落地,详情在本文件 2026-08-19 三条 + 坑 40/41/42/43/44/45,⛔ 别重新论证。

## [2026-09-04] CAIS HLE 落地(#108):出题方自己的读数取代第三方镜像当 primary `#ship` `#decision` `#measure`

owner 裁决「按推荐修、自动合」后合的。batch-38 = CAIS AI Dashboard,**HLE 的出题方自己的板**。

`#measure` **实测移动 15 个已发布数字**(不是 PR body 写的 18 —— 那是 2026-08-25 相对当时 main 的
计数,10 天里 main 动过,引用前重算了),外加 **16 格的证据等级从 `independent` 变成
`benchmark+independent``。⭐ **后者才是机制**:分数没动,但格子里谁当 primary 变了 ——
规则 3(benchmark-native > independent)本来就该让出题方的读数压过 AA 的镜像。
典型移动:Opus 5 54.9→51 · Fable 5 55.5→52.72 · Terra 42.9→35.88 · Muse Spark 1.1 46.2→**49.44↑**
(方向不是一边倒,所以不是系统性偏移)。合并后实测 **2221 obs / 1402 格 / 67.1%**
(benchmark 932→**948**,independent 与 vendor 未变)—— 覆盖率没变,变的是同一格里谁说话。

⚠ 合之前解过两次冲突,两次的解法都值得记:
- `data/model-aliases.json` —— 两边都只是往同一个数组**追加条目**,保留双方即可(HEAD 的 CAIS
  五条 + main 的 batch-38/39 file-scoped 拒绝),解完 `json.load` 验一遍再走。
- `app/observations.generated.ts` —— ⛔ **不要手工解**,它是生成物:取任一侧再 `npm run ingest` 重跑。
  (硬规则 3 的直接推论,冲突时最容易忘。)

⇒ 这条也是 tier-B 条件 2 的**唯一一次真实触发**:#105/#109 是被旧措辞误挡的,#108 是真的该停,
而它自己在 body 里点名了是哪一条不满足。⇒ **闸门的形状是对的,坏的只是措辞。**

## [2026-09-04] owner 一次裁决三道题:#122 不管 · 「最新发布」看板不做 · hermes 不推微信 `#decision`

原话:「1不用,3不用管,2不用管了改了就改了收尾吧」。三条都**封口**,记在这里是为了下一个 session
不重开 —— 三道题都是那种「看起来像没做完的自动化」,不写死就会被当成缺陷重新提上来。

**① issue #122(LiveBench 改写了冻结版下 3 个 nemotron 的分)—— 不管。**
裁决站得住是因为先量过:`nemotron` 不在目录里,那 3 格一格都没进 `observations.generated.ts`
⇒ 站上看不见,纯归档记账题。⛔ **没有去造「接受上游改写」的口子** ——
`fetch-source.mjs` 明写着 *a moved number is an integrity failure no written reason can excuse*,
`withdrawnRows` 只赦免 vanish、永不赦免 change,那是设计。
⚠ 代价写进坑 **54**:每日 drift job 从此**长期红**,#122 **长期开着**,⛔⛔ 别去关它
(关了明天重开,而「开」会再推一次微信;挂着不动是静默原地编辑)。
⇒ **这个 job 的红从今天起不再是一个可用的新信号** —— 下一次真出别的 integrity 问题,
看到的还是同一片红,要靠 issue body 里的 cell 清单分辨。这是这次裁决真正的成本,不是「零成本」。

**② 「最新发布」看板 —— 不做。** 连带把新模型这条线整个封了:地板 8-12 判过不放开,
展示位 09-04 判过不做 ⇒ **新模型进不了目录就是最终状态**。
⛔ 别再把「`auto/new-model` 闸门从没触发过」当 bug 报上来 —— 它每天都在正确地拒绝。

**③ hermes 死了推微信 —— 不推。** 维持 `upstream.yml` 写明的理由(「没人在做的队列值得记下来,
不值得打扰」),也就维持 8-06 那次 10→4 的裁剪。⭐ 但**读数**同日已经补上了:
`check:heartbeat --agent` 会打一行「最后一次 agent 署名的 commit 距今多久」——
想知道的时候查得到,只是不会主动来找你。⇒ 这条与 ① 是同一种取舍:**接受一个不会主动说话的洞,
但要求它在被问到时答得出来。**

⇒ `TODO.md` 顶部那节从此**没有「要你定」**,只剩两条要在真跑里看一眼的观察项。
