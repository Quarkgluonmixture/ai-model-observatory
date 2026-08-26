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
  claim: ["模型和 Agent 会失败,", "测它们的尺子也会。"],
  intro:
    "我研究模型和 Agent 在哪里失败，也研究我们用来测它们的尺子本身是否可信。工作横跨 Web / Computer-Use Agent、LLM 红队、judge fidelity、benchmark design 和可复现实验系统；现在在 Holistic AI 做 Research Intern。",
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
      "Web agent 可以读 DOM、Set-of-Marks、原始视觉或混合表征。我把「不同表征有没有互补价值」和「router 能不能学会何时选它」拆开测，最后得到的不是一个漂亮的 routing 胜利，而是一条更有用的边界：最值得路由的地方，往往也最难可靠学习。",
    points: [
      "构建 DOM / SoM / vision 与 phantom representations 的受控比较，先预注册再跑实验；不同表征确实留下非冗余的 oracle headroom。",
      "主结果是 routing value–learnability gap：value 不等于可预测性，负结果和 failure analysis 直接进入论文主线。",
      "机制侧继续用 activation patching 和 linear probes 追表征差异；工程侧约 117K 行 Python、1,121 个测试，跨异构算力自动编排与恢复。",
      "论文已投 EMNLP 2026 Workshop REALM 与 NeurIPS 2026 Workshop VLM4RWD。",
    ],
    stack: "Python · PyTorch · Playwright · VisualWebArena · SGE/HPC",
    href: "https://github.com/Quarkgluonmixture/Cost-Aware-Routing-for-Web-Usage-Agents",
    span: "c12",
    wide: true,
    bigTitle: true,
    chart: "cost",
    cap: "六种观测模式的账单成本接近；真正需要解释的是信号、延迟和可学习性。",
  },
  {
    slot: "02",
    kicker: "02 / Public Red-Team Measurement Stack / Apache-2.0",
    title: "redteam-under-test",
    who: [{ text: "公开可审计系统" }, { text: "独立重构" }, { text: "2026" }],
    lead:
      "红队工具在测模型，但判官和 harness 自己也会错。我把攻击生成、target execution 和判官质量放在同一条测量链里：攻击要针对目标动态生成，判官要对独立 gold labels 报自己的 FP/FN。",
    shot: {
      src: "/shots/redteam-cockpit.jpg",
      alt: "redteam-under-test cockpit：风险图、攻击面、成本与运行趋势",
      cap: "同一套系统里看攻击面，也看自己的判官是否可信",
    },
    metersLabel: "判官对独立 gold labels 的测量结果",
    meters: [
      { label: "本仓库 judge recall", value: ".712–.753", pct: 73, tone: "a" },
      { label: "本仓库 judge precision", value: ".93–.98", pct: 95, tone: "n" },
      { label: "upstream rubric recall", value: ".247", pct: 24.7, tone: "w" },
    ],
    points: [
      "166 个 plugin 映射到本地生成机制，103 个经端到端验证后启用；11 个攻击技术重实现为本地 engine。",
      "攻击根据目标领域动态实例化，不重放固定 prompt bank；zero-egress 路径可以把生成、攻击和判定都留在本机。",
      "一个 upstream refusal shortcut 在单个 cybercrime probe 上造成 16 个 breach 漏掉 8 个；所以这里把 grader 本身当成测量仪器来校准。",
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
    lead:
      "同一个 Agent Security 项目里，我从比赛攻击和基础设施防守两边看 tool-using agent：Kaggle 侧研究怎样在有限 replay / model-hop 预算里触发危险工具链；SCNet 侧把防守分析器做成只读 MCP，只分析 tool-call trace，不执行真实动作。",
    points: [
      "Kaggle AI Agent Security 竞赛侧围绕 replay budget、model-hop 和调用成本优化攻击组合，而不是只调 prompt；公开最佳分 72.72。",
      "SCNet / 国家超算互联网侧的 scientific-agent-security-analyzer 作为防守 MCP 接入，验证记录 574 passed / 1 skipped。",
      "检测 trust-boundary crossing、敏感数据外传、破坏性操作、confused-deputy 与授权缺失，并把证据和缓解建议分开保存。",
      "防守 MCP 支持 stdio 与 Streamable HTTP；规则采用「降级不压制」，调用方自报审批不能让发现凭空消失。",
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
    lead:
      "同一份分数上涨可能来自三件完全不同的事：prompt 协议对齐、answer-format SFT、显式思考。我每次只动一个变量，避免把协议修正误叫成模型能力提升。",
    meters: [
      { label: "只换原生 chat 协议", value: "+20~30", pct: 100, tone: "a" },
      { label: "answer-only SFT (4B)", value: "31 fix / 38 break", pct: 45, tone: "n" },
      { label: "GRPO 后 (8B)", value: "31% → 9.7%", pct: 31, tone: "w" },
    ],
    points: [
      "较大的 base model 只切回原生 chat protocol、不微调也不思考，就能回收约 +20–30 分。",
      "4B answer-only SFT 相对公平基线并没有显著净增益；paired McNemar 把“看起来涨了”变成可检验的问题。",
      "GRPO/RLVR 反而把格式奖励黑掉：78% 样本吐空 answer tag 换格式分，准确率从 31% 掉到 9.7%。",
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
    lead:
      "模型榜单最容易把不同来源、不同 harness、不同语义的数字揉成一个假总分。我反过来做：每个 observation 都保留来源、版本、日期和测量语义；证据不够就写 N/A。",
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
      "2,133 条观测全部带 provenance；当前目录 321 / 321 个 catalog 数值能回到归档证据。",
      "自动重抓上游来源并检查 drift；缺失不是 0，agent-system 结果也不伪装成纯模型能力。",
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
  { k: "Working principle", v: "先问 measurement chain 是否可信，再相信一个更高的分数；负结果和失败模式也进入结论。" },
];

export const experience = [
  {
    org: "Holistic AI",
    what: "Research Intern · London · 2026.06–09。做 LLM / Agent 红队与评测能力、grader 质量和 failure analysis，并把测量链接进实际平台。",
  },
  {
    org: "UCL Computer Science",
    what: "MSc Artificial Intelligence for Sustainable Development · 2025–2026。当前 taught average 70.65，on track for Distinction。",
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
    text: "ChatGPT Web 做研究/裁决，GitHub 传 durable request/result，自托管 runner 只执行 allowlist action，再把结果唤醒回同一段对话。重点是 capability boundary，不是给 agent 一个任意 shell。",
    href: "https://github.com/Quarkgluonmixture/gpt-loop",
  },
  {
    name: "Autonomous Agent Prediction",
    year: "2026",
    text: "60 分钟、$2 LLM 预算、纯 CPU 的自主 ML agent。最终 private 0.780，571 队第 131；竞争带里 public/private Spearman 只有 0.142。",
    href: "https://github.com/Quarkgluonmixture/autonomous-agent-prediction-beta",
  },
  {
    name: "paper-deslop",
    year: "2026",
    text: "LaTeX-aware 学术改写流水线：语义改写只出 diff，由人审；确定性 invariant gate 盯数字、引用、公式、术语和句子绑定没被改坏。",
    href: "https://github.com/Quarkgluonmixture/paper-deslop",
  },
  {
    name: "Encode Persona",
    year: "2026",
    text: "比较自然语言、JSON/YAML、可读语义标签与 opaque tags 的 persona representation；做 ablation、跨模型 probe、exact provenance 和 blind judge。",
    href: "https://github.com/Quarkgluonmixture/encode-persona",
  },
  {
    name: "Spatial Copilot",
    year: "2026",
    text: "把第一人称口述实时变成持久拓扑地图；graph topology 是真相，geometry 只是视觉假设，支持本地 STT、event sourcing、undo/redo 与 loop closure。",
    href: "https://github.com/Quarkgluonmixture/Spatial-Copilot",
  },
  {
    name: "FitnessOS",
    year: "2026",
    text: "offline-first SwiftUI 健身系统：SQLite source of truth、HealthKit、确定性调度、proposal/outbox、真实 iPhone 验证与完整 CI。",
    href: "https://github.com/Quarkgluonmixture/FitnessOS",
  },
  {
    name: "EvoFootball Arena",
    year: "2026",
    text: "逐字节可复现的 6v6 足球演化模拟：16 个可解释战术基因、seeded RNG、状态存档与长时 Web Worker 模拟。",
    href: "https://github.com/Quarkgluonmixture/evofootball-arena",
  },
  {
    name: "Emberfall",
    year: "2026",
    text: "确定性多文明模拟：160×100 世界里文明兴起、结盟、战争、覆灭和重建；近景展开个体，远景只算聚合状态。",
    href: "https://github.com/Quarkgluonmixture/Emberfall",
  },
  {
    name: "Africa → China Satellite Transfer",
    year: "2025–26",
    text: "Sentinel-2 财富回归与跨洲 distribution shift：多 backbone、多 seed、bootstrap CI、自建贵州对抗评估集和 Grad-CAM。",
    href: "https://github.com/Quarkgluonmixture/africa_china_poverty",
  },
];

export const closing = {
  title: "在找 AI Evaluation / Red Teaming / Agent Reliability 方向的 Research Engineer 岗位",
  sub: "Web / Computer-Use Agent 和 model/post-training evaluation 是两条相邻方向。想聊哪个项目，直接看代码或发邮件。",
  todo: "",
};

// Six observation modes: relative bill-cost heights. Exact per-mode values are
// deliberately not invented; the project copy only claims the observed range.
export const costBars = { heights: [80, 84, 91, 82, 86, 79], hi: 3 };

// Kept for the generic score-chart component even though no current featured
// card uses it.
export const scoreLine = "6,50 51.6,42.6 97.2,35 142.8,26.3 188.4,6 234,6.1";
