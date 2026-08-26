// Copy for the personal site at the root route.
// 2026-08-23: recruiter-facing positioning is intentionally selective.
// The homepage is not a museum of every repository; it foregrounds the work
// that best supports AI evaluation, red teaming and reliable agents.

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
  role: "AI Evaluation · Red Teaming · Agent Reliability",
  availability: "Research Engineer · 2026 秋",
  claim: ["模型和 Agent 会出问题。", "更麻烦的是，用来评估它们的那套标准本身也可能不可靠。"],
  intro:
    "我做 LLM / Agent 评测和红队测试。一个模型到底安不安全、一次分数到底值不值得信，很多时候不只是模型本身说了算——拒答、provider filter、执行环境、judge 误判，都可能让同一个结果得出完全不同的结论。所以我的工作一直围绕一件事：先把问题出在哪搞清楚，再判断一个更高的分数到底意味着什么。工作覆盖 Web / Computer-Use Agent、LLM 红队、judge / grader reliability、benchmark design 和可复现实验系统。目前在 Holistic AI 做 Research Intern。",
  github: "https://github.com/Quarkgluonmixture",
  figures: [
    { value: "2", label: "个 2026 workshop submission" },
    { value: "1,121", label: "个 Web-Agent 研究测试" },
    { value: "103", label: "个验证过的红队 plugin" },
    { value: "2,133", label: "条模型观测" },
  ],
  nav: [
    { href: "#work", label: "研究与系统" },
    { href: "#skills", label: "技能" },
    { href: "#about", label: "经历" },
    { href: "#contact", label: "联系" },
  ],
};

export const featured: Featured[] = [
  {
    slot: "01",
    kicker: "01 / UCL MSc Dissertation / REALM + NeurIPS VLM4RWD submitted",
    title: "Web Agent 的表征路由：价值越大，反而越难学",
    who: [{ text: "独立研究" }, { text: "预注册 · OSF" }, { text: "3 模型族 × 6 表征" }],
    lead:
      "Web Agent 可以看 DOM、SoM、原始视觉，也可以把几种表征混在一起。最诱人的假设是：哪种表征在某个任务上更有价值，router 就应该更容易学会什么时候选它。但结果并不是这样。我把「表征之间到底有没有互补价值」和「router 能不能提前预测这种价值」拆成两个问题单独测。不同表征之间确实还有互补空间，也留下了真实的天花板（oracle headroom），但越值得动态路由的地方，往往也越难可靠预测。",
    points: [
      "DOM / SoM / vision 与 phantom representations 做受控比较，先预注册，再跑实验。",
      "最后论文的主线变成了 routing value–learnability gap：value 不等于 learnability。一个方法理论上值得做，不代表它在现实里学得出来。",
      "不只看平均分，也追 task-level failure 和 representation difference；activation patching 和 linear probes 用来定位表征差异。",
      "工程侧约 117K 行 Python、1,121 个测试，支持异构算力上的自动编排与恢复。",
      "论文已投 EMNLP 2026 Workshop REALM 与 NeurIPS 2026 Workshop VLM4RWD。",
    ],
    stack: "Python · PyTorch · Playwright · VisualWebArena · SGE/HPC",
    href: "https://github.com/Quarkgluonmixture/Cost-Aware-Routing-for-Web-Usage-Agents",
    span: "c12",
    wide: true,
    bigTitle: true,
    chart: "cost",
    cap: "六种观测模式的成本其实差得没想象中大。真正难的是：什么时候该看什么，以及这个判断到底学不学得出来。",
  },
  {
    slot: "02",
    kicker: "02 / Public Red-Team Measurement Stack / Apache-2.0",
    title: "redteam-under-test",
    who: [{ text: "公开可审计系统" }, { text: "独立重构" }, { text: "2026" }],
    pull: "攻击跑出来了，不等于攻击真的成功了。",
    lead:
      "红队系统里有个很容易被忽略的问题：我们花很多力气攻击模型，却经常默认负责判断攻击有没有成功的那套东西是对的。但模型拒答、provider filter、harness 行为和 grader 误判，在最终结果里很容易长得一模一样。所以在 redteam-under-test 里，我不只测 target，也测用来评估 target 的工具本身。攻击生成、target execution、judge 和独立 gold labels 放进同一条 measurement chain；judge 不只给别人打分，也必须交代自己的 precision、recall 和 FP/FN。",
    shot: {
      src: "/shots/redteam-cockpit.jpg",
      alt: "redteam-under-test cockpit：风险图、攻击面、成本与运行趋势",
      cap: "同一套系统里看攻击面，也看自己的判官是否可信",
    },
    metersLabel: "Judge 对独立 gold labels 的测量结果",
    meters: [
      { label: "本仓库 judge recall", value: ".712–.753", pct: 73, tone: "a" },
      { label: "本仓库 judge precision", value: ".93–.98", pct: 95, tone: "n" },
      { label: "upstream rubric recall", value: ".247", pct: 24.7, tone: "w" },
    ],
    points: [
      "166 个 plugin 映射到本地生成机制，其中 103 个通过端到端验证后启用；11 种攻击技术重实现为本地 engine。",
      "攻击按目标动态生成，不靠固定 prompt bank 重放；zero-egress 路径可以把生成、攻击和判定都留在本机。",
      "一个 upstream refusal shortcut 曾经在单个 cybercrime probe 上漏掉 16 个 breach 里的 8 个。",
      "grader 自己也会出错，它同样需要校准。",
    ],
    stack: "JavaScript · Node · Postgres · TanStack Start · SST / Lambda",
    href: "https://github.com/Quarkgluonmixture/redteam-under-test",
    span: "c7",
  },
  {
    slot: "03",
    kicker: "03 / Kaggle AI Agent Security / SCNet MCP",
    title: "Agent Red-Team Lab",
    who: [{ text: "Kaggle · 72.72" }, { text: "SCNet · Gluons" }, { text: "Read-only MCP" }],
    pull: "一边想办法诱导 Agent 做出越界行为，一边想办法在它真越界时留下证据。",
    lead:
      "同一个 Agent Security 项目里，Kaggle 侧做攻击，SCNet 侧做防守。Kaggle 研究怎样在有限 replay / model-hop 预算和调用成本下组合攻击；SCNet 把 scientific-agent-security-analyzer 做成 read-only MCP，只分析 tool-call trace，不执行真实动作。",
    points: [
      "Kaggle AI Agent Security 竞赛侧围绕 replay budget、model-hop 和调用成本优化攻击组合，而不是单纯继续拧 prompt；公开最佳分 72.72。",
      "SCNet / 国家超算互联网侧的 scientific-agent-security-analyzer 作为防守 MCP 接入，验证记录 574 passed / 1 skipped。",
      "检测 trust-boundary crossing、敏感数据外传、destructive action、confused-deputy 与缺失授权，并把发现了什么和建议怎么处理分开保存。",
      "防守 MCP 支持 stdio 与 Streamable HTTP；规则采用「降级不压制」：调用方即使自报“已经审批”，也不能一句话把已经发现的风险压掉。",
    ],
    stack: "Python · MCP / JSON-RPC · Agent Security · SCNet",
    href: "https://github.com/Quarkgluonmixture/agent-redteam-lab",
    span: "c5",
  },
  {
    slot: "04",
    kicker: "04 / FinQA / Post-training Attribution",
    title: "FinQA",
    who: [{ text: "Qwen3 0.6B→14B" }, { text: "5×4 controlled matrix" }, { text: "2026" }],
    pull: "模型涨了 20 分，先别急着说训练有效。",
    lead:
      "同一份分数上涨，可能来自完全不同的东西：prompt 协议对齐、answer-format SFT、显式思考，或者模型干脆学会了怎么钻 reward 的空子。所以我每次都只动一个变量。目的不是想办法把分做高，而是回答一个更基本的问题：这几十分，到底是能力，还是协议？结果也很直接。",
    meters: [
      { label: "只换原生 chat 协议", value: "+20~30", pct: 100, tone: "a" },
      { label: "answer-only SFT (4B)", value: "31 fix / 38 break", pct: 45, tone: "n" },
      { label: "GRPO 后 (8B)", value: "31% → 9.7%", pct: 31, tone: "w" },
    ],
    points: [
      "较大规模的 base model 不微调、不显式思考，只切回正确的原生 chat protocol，就能拿回约 +20–30 分。不少所谓“能力差距”，其实一开始就是协议没对上。",
      "4B answer-only SFT 相对公平基线没有显著净增益；paired McNemar 把“感觉涨了”变成一个可以被统计检验的问题。",
      "GRPO/RLVR 出现了明显的 reward exploitation：78% 的样本输出空 answer tag 来拿格式分，任务准确率反而从 31% 掉到 9.7%。",
      "分数涨了，模型不一定真的变强了。",
    ],
    stack: "Python · PyTorch · Qwen3 · TRL · LoRA / SFT / GRPO",
    href: "https://github.com/Quarkgluonmixture/FinQA",
    span: "c6",
  },
  {
    slot: "05",
    kicker: "05 / Benchmark Provenance / Live",
    title: "AI Model Observatory",
    who: [{ text: "29 模型家族 × 72 benchmarks" }, { text: "2,133 observations" }, { text: "已上线" }],
    pull: "我最不想做的，就是再造一个“万能总分”。",
    lead:
      "模型榜单最方便的做法，是把不同来源、不同 harness、不同 benchmark 语义的数字揉到一起，然后给你一个很好比较的总分。问题是：方便比较，不等于比较成立。所以我反过来做。每条 observation 都保留来源、版本、日期和测量语义。证据不够，就是 N/A。缺失不是 0。agent-system 的成绩，也不会被包装成纯模型能力。",
    shot: {
      src: "/shots/observatory-home.jpg",
      alt: "AI Model Observatory 首页与模型比较界面",
      cap: "能力、agent 系统、coding 系统、人类偏好和价格速度分开看",
    },
    chart: "ring",
    ringPct: 66.2,
    meters: [
      { label: "模型家族 × benchmark", value: "29 × 72", pct: 0 },
      { label: "已填充 / 总格数", value: "1382 / 2088", pct: 66.2, tone: "a" },
    ],
    points: [
      "2,133 条 observation 全部带 provenance；当前目录 321 / 321 个 catalog 数值都能回到归档证据。",
      "自动重抓上游来源并检查 drift；缺失不是 0，agent-system 结果也不伪装成纯模型能力。",
      "这里宁愿留着 N/A，也不拿一个解释不清的数字把表格填满。",
    ],
    stack: "TypeScript · Next.js · Data Provenance · EdgeOne Pages",
    href: "/models",
    goLabel: "进入观测台 →",
    span: "c6",
  },
];

export const skills = [
  { k: "Evaluation / Research", v: "LLM & Agent evaluation · benchmark design · red teaming · judge / grader calibration · failure taxonomy · paired tests / bootstrap · preregistration" },
  { k: "Agents", v: "Web / Computer-Use Agent · VisualWebArena · DOM / SoM / vision representations · tool use · MCP · multi-agent orchestration" },
  { k: "Model / Post-training", v: "PyTorch · Hugging Face · TRL · LoRA / SFT · GRPO / RLVR analysis · Qwen / DeepSeek / Gemma" },
  { k: "Engineering", v: "Python · TypeScript / JavaScript · SQL / Postgres · Playwright · Docker · GitHub Actions · Linux · AWS / SST · Next.js / TanStack" },
  { k: "Research systems", v: "异构算力编排 · SGE / HPC · structured logging · watchdog / recovery · data provenance · reproducible experiment harness" },
  { k: "Working principle", v: "先检查 measurement chain，再相信一个更高的分数。负结果不是废结果。只要它能说明一个方法为什么不工作，就值得留下。" },
];

export const experience = [
  {
    org: "Holistic AI",
    what: "Research Intern · London · 2026.06–09。做 LLM / Agent 评测与红队测试，分析 grader 质量和 failure modes，并把这套 measurement chain 接进实际平台。",
  },
  {
    org: "UCL Computer Science",
    what: "MSc Artificial Intelligence for Sustainable Development · 2025–2026。研究重点是 Web / Computer-Use Agent evaluation 与 representation routing。",
  },
  {
    org: "西安交通大学",
    what: "BEng Automation · 2021–2025。",
  },
  {
    org: "Earlier",
    what: "华电系 AI / 数智化实习；绿盟科技网络安全测试实习。",
  },
];

export const others = [
  {
    name: "GPT Loop",
    year: "2026",
    text: "ChatGPT Web 负责研究与裁决，GitHub 传 durable request/result，自托管 runner 只执行 allowlist action，最后把结果送回同一段对话。重点不是给 Agent 一个 shell，而是让它有能力做事，同时又明确知道哪扇门不能开。",
    href: "https://github.com/Quarkgluonmixture/gpt-loop",
  },
  {
    name: "Autonomous Agent Prediction",
    year: "2026",
    text: "60 分钟、$2 LLM 预算、纯 CPU 的自主 ML agent。最终 private 0.780，571 队第 131；竞争带里的 public/private Spearman 只有 0.142。榜单看起来很精确，排序本身却未必稳定。",
    href: "https://github.com/Quarkgluonmixture/autonomous-agent-prediction-beta",
  },
  {
    name: "paper-deslop",
    year: "2026",
    text: "LaTeX-aware 学术改写流水线。语义改写只生成 diff，由人审；确定性 invariant gate 校验数字、引用、公式、术语和句子绑定有没有被误改。模型负责提议，确定性规则负责不让它偷偷改事实。",
    href: "https://github.com/Quarkgluonmixture/paper-deslop",
  },
  {
    name: "Encode Persona",
    year: "2026",
    text: "比较自然语言、JSON/YAML、可读语义标签和 opaque tags 的 persona representation。做 ablation、跨模型 probe、exact provenance 和 blind judge。我关心的不只是 persona 能不能编码进去，还关心编码方式本身到底改变了什么。",
    href: "https://github.com/Quarkgluonmixture/encode-persona",
  },
  {
    name: "Spatial Copilot",
    year: "2026",
    text: "把第一人称口述实时变成持久拓扑地图。graph topology 是事实，geometry 只是视觉假设。支持本地 STT、event sourcing、undo/redo 和 loop closure。",
    href: "https://github.com/Quarkgluonmixture/Spatial-Copilot",
  },
  {
    name: "FitnessOS",
    year: "2026",
    text: "offline-first SwiftUI 健身系统。SQLite 是 source of truth，接 HealthKit、确定性调度、proposal/outbox，并且在真实 iPhone 上验证。",
    href: "https://github.com/Quarkgluonmixture/FitnessOS",
  },
  {
    name: "EvoFootball Arena",
    year: "2026",
    text: "可逐字节复现的 6v6 足球演化模拟。16 个可解释战术基因、seeded RNG、状态存档和长时 Web Worker 模拟。",
    href: "https://github.com/Quarkgluonmixture/evofootball-arena",
  },
  {
    name: "Emberfall",
    year: "2026",
    text: "确定性多文明模拟。160×100 世界里文明兴起、结盟、战争、覆灭和重建；近景展开个体，远景只计算聚合状态。",
    href: "https://github.com/Quarkgluonmixture/Emberfall",
  },
  {
    name: "Africa → China Satellite Transfer",
    year: "2025–26",
    text: "Sentinel-2 财富回归与跨洲 distribution shift。多 backbone、多 seed、bootstrap CI、自建贵州对抗评估集和 Grad-CAM。",
    href: "https://github.com/Quarkgluonmixture/africa_china_poverty",
  },
];

export const closing = {
  title: "我想继续做一件事：把模型和 Agent 的“看起来不错”，变成真正经得住检查的结果。",
  sub: "目前重点看 AI Evaluation / Red Teaming / Agent Reliability 方向的 Research Engineer 岗位。Web / Computer-Use Agent、model/post-training evaluation 也是我会继续往下做的两条线。想聊哪个项目，直接看代码。觉得有意思，再给我发邮件。",
  todo: "",
};

// Six observation modes: relative bill-cost heights. Exact per-mode values are
// deliberately not invented; the project copy only claims the observed range.
export const costBars = { heights: [80, 84, 91, 82, 86, 79], hi: 3 };

// Kept for the generic score-chart component even though no current featured
// card uses it.
export const scoreLine = "6,50 51.6,42.6 97.2,35 142.8,26.3 188.4,6 234,6.1";