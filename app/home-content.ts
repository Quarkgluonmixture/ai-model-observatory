// Copy for the personal site at the root route. Hand-written, mirrored from
// quark-space/content/projects.json — that file is the source of truth for wording and
// carries the copy rules (subject in every sentence, short clauses, no slogans,
// banned words: 护航 / 赋能 / 有据可查 / 不可替代 / 全方位). Keep them in sync by hand for now.
//
// Facts only come from buqi-docs/项目库. Anything unknown stays a TODO chip on the page
// rather than being filled in with a guess.

export type Meter = { label: string; value: string; pct: number; tone?: "a" | "n" | "w"; faint?: boolean };

export type Featured = {
  slot: string;
  kicker: string;
  title: string;
  who: { text: string; todo?: boolean }[];
  lead: string;
  points?: string[];
  meters?: Meter[];
  metersLabel?: string;
  stack: string;
  href: string;
  goLabel?: string;
  span: "c12" | "c7" | "c6" | "c5";
  wide?: boolean;
  bigTitle?: boolean;
  shot?: { src: string; alt: string; cap: string };
  pull?: string;
  chart?: "cost" | "score" | "ring";
  ringPct?: number;
  cap?: string;
};

export const profile = {
  name: "Jiaming Wei",
  role: "LLM 评测 · 红队 · Agent 安全",
  availability: "求职中 · 2026",
  claim: ["模型要测,", "量模型的尺子也要测。"],
  intro:
    "我做 LLM 评测和红队测试:一个模型有多安全、一个分数值不值得信,由我把它测出来。难的往往不是攻击模型,是判断攻击到底成功了没有 —— 拒答、内容过滤、判官自己判错,在结果里长得很像。所以我也花力气去测自己的判官。业余写确定性模拟,同一个种子跑出同一段历史。",
  github: "https://github.com/Quarkgluonmixture",
  figures: [
    { value: ".71–.75", label: "判官 recall,上游同批 .247" },
    { value: "103", label: "个验证过的红队 plugin" },
    { value: "11", label: "个本地攻击引擎" },
    { value: "2,133", label: "条模型观测" },
  ],
  nav: [
    { href: "#work", label: "项目" },
    { href: "#skills", label: "技能" },
    { href: "#about", label: "经历" },
    { href: "#contact", label: "联系" },
  ],
};

export const featured: Featured[] = [
  {
    slot: "01",
    kicker: "01 / MSc 毕设 / 预注册 · OSF",
    title: "Web Agent 的成本感知路由",
    who: [{ text: "MSc 毕设" }, { text: "独立完成" }, { text: "4 个月 · 1,088 commits" }],
    lead:
      "Web agent 看页面有好几种方式:原始截图、无障碍树、Set-of-Marks。我想知道能不能留下 Set-of-Marks 的位置信息,却把图像整个丢掉。",
    points: [
      "提出 phantom_som:位置线索用纯文本给,不渲染标注截图,视觉编码器的图像 token 降到零。",
      "先预注册、在 OSF 锁定,再开始跑。3 个模型族 × 6 种观测模式 × 3 个站点;主门用单侧固定效应逆方差合并,再用 TOST 做等价检验。",
      "不只问「有没有效」,还用激活修补和线性探针去解释这种表征为什么有效。",
      "工程上是跨三层异构算力的编排:能防竞态,六层 watchdog 负责自己爬起来。~117K 行 Python、1,121 个测试。",
    ],
    stack: "Python · PyTorch · Playwright · SGE-HPC",
    href: "https://github.com/Quarkgluonmixture/Cost-Aware-Routing-for-Web-Usage-Agents",
    span: "c12",
    wide: true,
    bigTitle: true,
    chart: "cost",
    cap: "所以成本是地板 —— 六种模式的钱差不多,真正分化在延迟和信号。",
  },
  {
    slot: "02",
    kicker: "02 / 红队工具链 / Apache-2.0",
    title: "redteam-under-test",
    who: [{ text: "个人项目" }, { text: "独立完成" }, { text: "周期", todo: true }],
    lead:
      "红队工具都在测模型,很少有人测红队工具本身。它两件事同时做:对目标模型实时生成攻击,并检验自己的判官有没有判错。",
    shot: {
      src: "/shots/redteam-cockpit.jpg",
      alt: "红队 cockpit:风险图、攻击面热力图、成本与运行趋势",
      cap: "风险图、plugin × strategy 攻击面、成本与每次运行的突破率",
    },
    metersLabel: "判官准不准 · 对独立 gold label 打分",
    meters: [
      { label: "本仓库判官 recall", value: ".712–.753", pct: 73, tone: "a" },
      { label: "本仓库判官 precision", value: ".93–.98", pct: 95, tone: "n" },
      { label: "上游 rubric recall(同一批数据)", value: ".247", pct: 24.7, tone: "w" },
    ],
    points: [
      "上游 grader 会把看起来像拒答的回答直接判成防御成功,而且关不掉。一个以免责声明开头的突破就这样被记成安全 —— 单个 cybercrime 探针漏掉 16 之 8。",
      "166 个 plugin 映射进来,验证过的 103 个才允许启用;11 个攻击引擎跑在本地,数据不出机器。",
    ],
    stack: "JavaScript · Node 20+ · Postgres · SST / Lambda",
    href: "https://github.com/Quarkgluonmixture/redteam-under-test",
    span: "c7",
  },
  {
    slot: "03",
    kicker: "03 / 竞赛 + MCP 上线",
    title: "Agent Red-Team Lab",
    who: [{ text: "个人项目" }, { text: "独立完成" }, { text: "周期", todo: true }],
    lead:
      "同一个仓库里两条相反的线:一条在竞赛里诱导 agent 滥用工具,一条给科研 agent 做只读的工具调用安全分析,已上线国家超算互联网。",
    chart: "score",
    points: [
      "真正的瓶颈不是攻击写得好不好,是每个候选的重放成本。把模型的推理通道压掉之后,同样的预算能塞进 600 个候选,分数一跳到 54.1。",
      "防守侧检测 7 类风险,5 个 MCP 工具全部只读离线。规则是「降级不压制」:调用方自述的审批只能降低严重度,不能让一个发现消失。",
      "574 项测试通过;stdio 和 Streamable HTTP 两种传输都用官方 SDK 验过。",
    ],
    stack: "Python · MCP (JSON-RPC 2.0)",
    href: "https://github.com/Quarkgluonmixture/agent-redteam-lab",
    span: "c5",
  },
  {
    slot: "04",
    kicker: "04 / 后训练归因研究",
    title: "把后训练的涨点拆开",
    who: [{ text: "课程团队项目的单人扩展" }, { text: "周期", todo: true }],
    lead:
      "同一份涨幅有三种解释:协议对齐、格式 SFT、显式思考。我把它们分开,各自量了一遍 —— 5×4 的尺寸 × 条件矩阵,每次只动一个变量。",
    meters: [
      { label: "只换成原生 chat 协议(不微调)", value: "+20~30", pct: 100, tone: "a" },
      { label: "answer-only SFT(4B)", value: "修好 31 / 弄坏 38", pct: 9, tone: "n" },
      { label: "GRPO 之后(8B)", value: "31% → 9.7%", pct: 31, tone: "w" },
    ],
    points: [
      "最大的那一项是没人专门训练的:把 base 模型从训练式 prompt 换成原生 chat 协议,不微调也不思考,就回收 +20~30 分。",
      "有了这个诚实的分母,answer-only SFT 就几乎不加分了。三项结论都过了配对 McNemar。",
      "GRPO 把自己的格式奖励黑掉了:78% 的样本吐一个空标签去骗那 0.1 分格式分,准确率反而崩了。",
    ],
    stack: "Python · Qwen3 0.6B→14B · TRL · bf16 LoRA",
    href: "https://github.com/Quarkgluonmixture/FinQA",
    span: "c6",
  },
  {
    slot: "05",
    kicker: "05 / 评测台 / 已上线",
    title: "AI Model Observatory",
    who: [{ text: "个人项目" }, { text: "独立完成" }, { text: "周期", todo: true }],
    lead:
      "自己做的前沿模型对比台。它不把来源不同的分数混在一起,不做隐藏的总分;缺证据的格子就写 N/A,不补零也不估算。",
    shot: {
      src: "/shots/observatory-home.jpg",
      alt: "AI 模型观测站首页与前沿模型排行",
      cap: "排行按能力、系统表现、人类偏好分开排,不合成一个总分",
    },
    chart: "ring",
    ringPct: 66.2,
    meters: [
      { label: "模型家族 × benchmark", value: "29 × 72", pct: 0 },
      { label: "已填充 / 总格数", value: "1382 / 2088", pct: 66.2, tone: "a" },
    ],
    points: [
      "2,133 条观测,每条都带来源、版本、日期和 harness,能一路查回去。目录里的数字全部能对上源归档(321 / 321)。",
      "证据不够就不排名:五个 agent benchmark 只测了两个的模型显示 N/A —— 不拿更少的证据去和别人比。",
    ],
    stack: "TypeScript · Next.js · 双语 · 移动优先 · EdgeOne Pages",
    href: "/models",
    goLabel: "进入观测台 →",
    span: "c6",
  },
  {
    slot: "06",
    kicker: "06 / 模拟 / 已上线",
    title: "EvoFootball Arena",
    who: [{ text: "个人项目" }, { text: "独立完成" }, { text: "周期", todo: true }],
    shot: {
      src: "/shots/evofootball.jpg",
      alt: "EvoFootball Arena 3D 转播视图与战术基因面板",
      cap: "右边是每支队的战术基因和实时数据,每个决策都有分数可查",
    },
    pull: "同一个种子,跑出同一段历史。",
    lead: "AI 球队 6v6 打循环赛季,战术基因跨代进化,你只负责看。这里刻意不用强化学习。",
    points: [
      "每支队有 16 个能读懂的基因,每个决策背后的效用分数都能点开看 —— 「为什么这么踢」永远查得到。",
      "整套是逐字节确定性的:一个 seeded RNG、32-bit 状态存档,存档读回去再跑,结果一个字节都不差。",
      "长时模拟放在 Web Worker 里,界面稳在 60fps,结果和主线程一致,有回归测试盯着。",
    ],
    stack: "TypeScript · Vite · Pixi.js · Three.js",
    href: "https://github.com/Quarkgluonmixture/evofootball-arena",
    span: "c6",
  },
  {
    slot: "07",
    kicker: "07 / 遥感 ML / 跨大洲泛化",
    title: "卫星影像看经济水平",
    who: [{ text: "角色", todo: true }, { text: "周期", todo: true }],
    lead:
      "用非洲五国的 Sentinel-2 影像回归财富指数,再拿自己建的贵州 20 地数据集去问:在非洲学到的东西,搬到中国农村还灵不灵。",
    points: [
      "贵州那 20 个地方是专门挑出来做对抗的,用来看跨大洲的分布偏移会把模型打成什么样。",
      "PyTorch 复现并扩展了 Yeh et al. (2020, Nature Communications)。",
    ],
    metersLabel: "三个 backbone 的测试集 R²",
    meters: [
      { label: "ViT-S/16 (ImageNet)", value: "R² .683", pct: 68.3, tone: "a" },
      { label: "ResNet-50 (ImageNet)", value: "R² .650", pct: 65, tone: "n" },
      { label: "从零训练", value: "R² .614", pct: 61.4, tone: "n", faint: true },
    ],
    cap: "ImageNet 预训练有用,ViT 比 ResNet 再好一点;从零训练最差。",
    stack: "Python · PyTorch · timm · Sentinel-2",
    href: "https://github.com/Quarkgluonmixture/africa_china_poverty",
    span: "c12",
    wide: true,
  },
];

export const skills = [
  { k: "语言", v: "Python · TypeScript / JavaScript · Shell" },
  { k: "ML 与训练", v: "PyTorch · HF Transformers · TRL (SFT / GRPO) · bf16 LoRA · scikit-learn / LightGBM / CatBoost" },
  { k: "LLM 系统与评测", v: "红队 plugin 与策略引擎 · 判官保真度 · promptfoo · MCP (JSON-RPC 2.0) · Google ADK · Set-of-Marks web agent" },
  { k: "统计方法", v: "配对 McNemar · bootstrap CI · 固定效应逆方差合并 · TOST 等价检验 · 预注册" },
  { k: "Web 与基础设施", v: "Next.js / React · TanStack Start · Node · Postgres + Drizzle · SST / Lambda / Fargate · Docker Compose · Vite / Pixi.js / Three.js" },
  { k: "工程习惯", v: "能复现(seeded RNG、逐字节存档)· CI 里守数据合同 · 跨异构算力编排(HPC / SGE)· 崩溃能自己爬起来" },
];

export const experience = [
  {
    org: "UCL",
    what: "MSc Artificial Intelligence for Sustainable Development。毕设是上面那个成本感知路由。",
    todo: "起止时间",
  },
  { org: "西安交通大学", what: "本科。", todo: "专业与年份" },
  { org: "Holistic AI", what: "实习,做 LLM 红队评测和判官质量。", todo: "这一行怎么写你定" },
];

export const others = [
  {
    name: "Emberfall",
    year: "2026",
    text: "五个文明在 160×100 的网格上兴起、结盟、打仗、覆灭又重建。靠近镜头的聚落才展开成一个个市民,远处只算总量;整段历史逐字节可复现。",
    href: "https://github.com/Quarkgluonmixture/Emberfall",
  },
  {
    name: "Autonomous Agent Prediction",
    year: "2026",
    text: "Kaggle 给 60 分钟、2 美元、纯 CPU,agent 自己分析没见过的表格数据、训练、挑最终提交。public 约 0.817,130 队里前三分之一。",
    href: "https://github.com/Quarkgluonmixture/autonomous-agent-prediction-beta",
  },
  {
    name: "Lens–Voice Divergence",
    year: "2026",
    text: "大多数安全测试靠藏东西,这个什么都不藏:让模型一边批判某机构、一边用该机构的口气写作,看它认不认得出自己正在做刚才批判的事。",
    href: "https://github.com/Quarkgluonmixture/AI_safety",
  },
  {
    name: "paper-deslop",
    year: "2026",
    text: "按章节给论文提改写建议,每条附理由、由人逐项审。另一条轨道用确定性检查盯着数字、引用、公式和术语没被改坏。",
    href: "https://github.com/Quarkgluonmixture/paper-deslop",
  },
  {
    name: "claude-kit",
    year: "2026",
    text: "6 条按需引入的规则、4 个全局 skill、1 个 git 硬闸 hook。规则会被忘,hook 不会 —— 所以该拦的事交给 hook。",
    href: "https://github.com/Quarkgluonmixture/claude-kit",
  },
  {
    name: "Multi AI Chat",
    year: "2025",
    text: "Chrome 扩展:四家聊天网页各自独立作答,然后互相评审,最后一家把三份修订稿合成终稿。每题 7 次调用,不碰 API。",
    href: "https://github.com/Quarkgluonmixture/Multi_agent_system",
  },
];

export const closing = {
  title: "在找 AI 评测 / 红队 / Agent 方向的岗位",
  sub: "简历、GitHub 和邮箱都在这里,想聊哪个项目都可以。",
  todo: "具体岗位方向和联系方式你定",
};

// 六种观测模式的账单成本,高亮的是 phantom_som(第 4 根)。柱高是相对高度,
// 真实区间写在图下方,不在柱子上标数——素材只给了区间,没给逐模式的精确值。
export const costBars = { heights: [80, 84, 91, 82, 86, 79], hi: 3 };

// 竞赛分数 v9 → v39:6.195 / 14.810 / 23.530 / 33.600 / 54.120 / 54.000
export const scoreLine = "6,50 51.6,42.6 97.2,35 142.8,26.3 188.4,6 234,6.1";
