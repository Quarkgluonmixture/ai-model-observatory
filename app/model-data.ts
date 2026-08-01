import { INGESTED_ROWS } from "./observations.generated.ts";

export type ModelConfiguration = {
  /** The published operating point, e.g. "max". Null when the maker ships a single one. */
  effort: string | null;
  intelligence: number;
  /** Artificial Analysis cost per task. Null when no source publishes one. */
  costTask: number | null;
  speed: number | null;
  latency: number | null;
  textElo: number | null;
  codeElo: number | null;
  price: { input: number; output: number; cache: number };
  preliminary: boolean;
};

export type ModelRecord = {
  id: string;
  name: string;
  maker: string;
  color: string;
  open: boolean;
  contextK: number;
  tags: string[];
  /**
   * One record per model family; reasoning effort lives here and on the observation rows,
   * never in the model id. Leaderboards publish one line per model, so an id that encoded
   * an effort could not receive them without guessing which effort was meant.
   * Ordered strongest first.
   */
  configurations: ModelConfiguration[];
  // Flagship view, derived from configurations[0], so rankings read one number per model.
  intelligence: number;
  costTask: number | null;
  speed: number | null;
  latency: number | null;
  textElo: number | null;
  codeElo: number | null;
  price: { input: number; output: number; cache: number };
  preliminary: boolean;
};

export type BenchmarkAxis =
  | "reasoning"
  | "math"
  | "coding"
  | "agent"
  | "professional"
  | "multimodal"
  | "context";

export type BenchmarkMode = "model" | "system";
export type BenchmarkTier = "core" | "observe" | "legacy";
export type ScoreMethod = "execution" | "exam" | "rubric" | "preference";
export type SourceKind = "benchmark" | "vendor" | "independent";

export type BenchmarkRecord = {
  id: string;
  name: string;
  axis: BenchmarkAxis;
  mode: BenchmarkMode;
  tier: BenchmarkTier;
  method: ScoreMethod;
  unit: "%" | "Elo";
  version: string;
  source: string;
  url: string;
  zh: string;
  en: string;
};

const cfg = (
  effort: string | null,
  intelligence: number,
  costTask: number | null,
  speed: number | null,
  latency: number | null,
  textElo: number | null,
  codeElo: number | null,
  input: number,
  output: number,
  preliminary = false,
  cache: number | null = null,
): ModelConfiguration => ({ effort, intelligence, costTask, speed, latency, textElo, codeElo, price: { input, output, cache: cache ?? input / 10 }, preliminary });

const m = (
  id: string,
  name: string,
  maker: string,
  color: string,
  open: boolean,
  contextK: number,
  tags: string[],
  configurations: ModelConfiguration[],
): ModelRecord => {
  const [flagship] = configurations;
  // Arena publishes no per-effort boards, so its Elo is a family-level signal: take it from
  // whichever configuration carries one rather than losing it with a non-flagship variant.
  const textElo = configurations.find((entry) => entry.textElo !== null)?.textElo ?? null;
  const codeElo = configurations.find((entry) => entry.codeElo !== null)?.codeElo ?? null;
  return {
    id, name, maker, color, open, contextK, tags, configurations,
    intelligence: flagship.intelligence,
    costTask: flagship.costTask,
    speed: flagship.speed,
    latency: flagship.latency,
    textElo,
    codeElo,
    price: flagship.price,
    preliminary: flagship.preliminary,
  };
};

export const MODELS: ModelRecord[] = [
  m("claude-opus-5", "Claude Opus 5", "Anthropic", "#c8794d", false, 1000, ["reasoning", "vision", "agents"], [
    cfg("max", 61, 2.34, 53.8, 92.61, 1495, 1712, 5, 25, true, 0.5),
    cfg("xhigh", 60, 1.8, 53.7, 37.73, null, null, 5, 25, false, 0.5),
    cfg("high", 59, 1.23, 53.3, 17.77, 1493, 1669, 5, 25, false, 0.5),
  ]),
  m("claude-fable-5", "Claude Fable 5", "Anthropic", "#9c4f35", false, 1000, ["knowledge work", "writing", "coding"], [
    cfg("max", 60, 3.15, 66.9, 90.02, 1508, 1628, 10, 50, false, 1),
  ]),
  m("gpt-5.6-sol", "GPT-5.6 Sol", "OpenAI", "#bf8b18", false, 1000, ["reasoning", "coding", "presentation"], [
    cfg("max", 59, 1.86, 64.9, 149.14, null, null, 5, 30, false, 0.5),
    cfg("xhigh", 58, 1.17, 60.7, 54.02, 1485, 1623, 5, 30, false, 0.5),
    cfg("high", 56, 0.77, 57, 17.08, null, null, 5, 30, false, 0.5),
  ]),
  m("kimi-k3", "Kimi K3", "Moonshot", "#6d62cf", true, 1050, ["open weights", "webdev", "long context"], [
    cfg("max", 57, 0.86, 35.4, 3.94, 1486, 1682, 3, 15, true, 0.3),
  ]),
  m("gpt-5.6-terra", "GPT-5.6 Terra", "OpenAI", "#ecbb55", false, 1000, ["fast", "reasoning", "multimodal"], [
    cfg("max", 55, 0.73, 131.8, 198.08, null, null, 2.5, 15, false, 0.25),
    cfg("xhigh", 52, 0.43, 111.1, 29.72, 1468, 1522, 2.5, 15, false, 0.25),
  ]),
  m("grok-4.5", "Grok 4.5", "xAI", "#42576b", false, 500, ["coding", "reasoning", "realtime"], [
    cfg("high", 54, 0.44, 57.9, 8.62, 1468, 1550, 2, 6, false, 0.5),
  ]),
  m("claude-sonnet-5", "Claude Sonnet 5", "Anthropic", "#df9a72", false, 1000, ["coding", "agents", "fast"], [
    cfg("max", 53, 1.72, 79.1, 167.49, 1460, 1544, 2, 10, false, 0.2),
  ]),
  m("claude-opus-4.8", "Claude Opus 4.8", "Anthropic", "#a35f42", false, 1000, ["reasoning", "coding", "agents"], [
    cfg("max", 56, 1.36, 61.3, 10.06, 1474, 1539, 5, 25, false, 0.5),
  ]),
  m("glm-5.2", "GLM-5.2", "Z.ai", "#177f72", true, 1000, ["open weights", "coding", "low latency"], [
    cfg("max", 51, 0.29, 118.3, 1.43, 1469, 1588, 1.4, 4.4, false, 0.26),
  ]),
  m("muse-spark-1.1", "Muse Spark 1.1", "Meta", "#2d71b9", false, 1050, ["fast", "creative", "webdev"], [
    cfg("xhigh", 51, 0.29, 130, 2.64, 1491, 1536, 1.25, 4.25, true),
  ]),
  m("gpt-5.5", "GPT-5.5", "OpenAI", "#8d751e", false, 1000, ["reasoning", "codex", "long context"], [
    cfg("xhigh", 55, 0.91, 64.6, 99.32, 1476, 1507, 5, 30, false, 0.5),
  ]),
  m("gemini-3.5-flash", "Gemini 3.5 Flash", "Google", "#367ed8", false, 1000, ["fast", "vision", "long context"], [
    cfg("high", 50, 0.69, 171.5, 23.83, 1476, 1492, 1.5, 9, false, 0.15),
  ]),
  m("gemini-3.6-flash", "Gemini 3.6 Flash", "Google", "#4e96ed", false, 1000, ["very fast", "vision", "arena"], [
    cfg("high", 50, 0.56, 217.2, 15.11, 1482, 1528, 1.5, 7.5, true, 0.15),
  ]),
  m("deepseek-v4-flash", "DeepSeek V4 Flash 0731", "DeepSeek", "#6e56c6", true, 1000, ["open weights", "extreme value", "new"], [
    cfg(null, 50, 0.03, null, null, 1436, null, 0.14, 0.28, false, 0.003),
  ]),
  m("gemini-3.1-pro", "Gemini 3.1 Pro Preview", "Google", "#2567bd", false, 1000, ["vision", "arena", "long context"], [
    cfg(null, 46, 0.34, 123.3, 25.39, 1486, null, 2, 12, false, 0.2),
  ]),
  m("qwen3.7-max", "Qwen3.7 Max", "Alibaba", "#358a9a", true, 1000, ["open weights", "fast", "multilingual"], [
    cfg(null, 46, 1.28, 199.6, 2.45, 1475, 1517, 2.5, 7.5, false, 0.25),
  ]),
  m("deepseek-v4-pro", "DeepSeek V4 Pro", "DeepSeek", "#8467d6", true, 1000, ["open weights", "value", "reasoning"], [
    cfg("max", 44, 0.05, 64.4, 1.68, 1457, 1447, 0.435, 0.87, false, 0.004),
  ]),
  // --- Added from data/sources/batch-06-operating.jsonl -------------------------------
  // Field sources: intelligence / speed / latency = Artificial Analysis model pages.
  // Price = the official vendor page where one exists, else Artificial Analysis.
  // Elo = LMArena. LMArena's price column is deliberately NOT used; see the batch meta.
  // costTask comes from batch-07 (the AA leaderboard main table). Where that table has no
  // row for a configuration the field stays null and the model is absent from the value
  // lens, rather than being given a made-up cost.
  m("gpt-5.6-luna", "GPT-5.6 Luna", "OpenAI", "#f0cf82", false, 1050, ["fast", "reasoning", "value"], [
    cfg("max", 51, 0.07, 184.4, 116.5, null, null, 1, 6, false, 0.1),
    cfg("xhigh", 49, 0.04, 181.6, 37.91, 1452, 1525, 1, 6, false, 0.1),
    cfg("high", 46, 0.03, 163.3, 8.89, null, null, 1, 6, false, 0.1),
    cfg("medium", 38, 0.02, 163.5, 2.38, null, null, 1, 6, false, 0.1),
    cfg("low", 33, 0.01, 174.3, 1.53, null, null, 1, 6, false, 0.1),
    cfg("non-reasoning", 27, 0.02, 168.1, 0.77, null, null, 1, 6, false, 0.1),
  ]),
  m("kimi-k2.6", "Kimi K2.6", "Moonshot", "#8b7fe0", true, 256, ["open weights", "value", "reasoning"], [
    cfg("reasoning", 44, null, 57.9, 2.76, 1461, 1510, 0.95, 4, false, 0.16),
    cfg("non-reasoning", 35, null, 40.5, 2.81, null, null, 0.95, 4, false, 0.16),
  ]),
  m("kimi-k2.7-code", "Kimi K2.7 Code", "Moonshot", "#5b4fbe", true, 256, ["open weights", "coding"], [
    cfg(null, 42, 0.22, 51.6, 2.82, null, 1473, 0.95, 4, false, 0.19),
  ]),
  m("minimax-m3", "MiniMax-M3", "MiniMax", "#c2557a", true, 1000, ["open weights", "value", "fast"], [
    cfg(null, 44, 0.14, 77.2, 1.32, 1444, 1494, 0.3, 1.2, false, 0.06),
  ]),
  m("inkling", "Inkling", "Thinking Machines", "#3f8f6d", true, 1000, ["open weights", "reasoning"], [
    cfg("xhigh", 41, null, 85.1, 2.0, 1443, 1417, 1, 4.05, false, 0.17),
  ]),
  m("inkling-small", "Inkling Small", "Thinking Machines", "#6fb094", true, 1000, ["open weights", "fast"], [
    cfg(null, 40, 0.07, 93.5, 1.64, 1431, null, 0.3, 1.2, false, 0.06),
  ]),
  m("qwen3.6-plus", "Qwen3.6 Plus", "Alibaba", "#4aa3b4", false, 1000, ["fast", "value", "multilingual"], [
    cfg(null, 40, 0.36, 53.8, 2.41, 1443, 1458, 0.5, 3, false, 0.05),
  ]),
  m("qwen3.6-max", "Qwen3.6 Max Preview", "Alibaba", "#2a6f7d", false, 256, ["multilingual", "preview"], [
    cfg(null, 40, null, 45.9, 3.29, 1460, 1478, 1.3, 7.8, true, 0.13),
  ]),
  m("grok-4.3", "Grok 4.3", "xAI", "#6b7f93", false, 1000, ["reasoning", "deprecated"], [
    cfg("high", 38, null, 147.5, 18.88, 1443, 1358, 1.25, 2.5, false, 0.2),
    cfg("non-reasoning", 25, 0.29, 124.7, 0.81, null, null, 1.25, 2.5, false, 0.2),
  ]),
  m("gemini-3-flash", "Gemini 3 Flash", "Google", "#8fb8ee", false, 1000, ["fast", "deprecated"], [
    cfg("non-reasoning", 27, null, 176.0, 0.82, 1473, 1438, 0.5, 3, false, 0.05),
  ]),
];


export const AXES: { id: BenchmarkAxis; zh: string; en: string; weight: number }[] = [
  { id: "reasoning", zh: "推理与知识", en: "Reasoning & knowledge", weight: 18 },
  { id: "math", zh: "数学与科学", en: "Math & science", weight: 12 },
  { id: "coding", zh: "编程与软件工程", en: "Coding & software", weight: 20 },
  { id: "agent", zh: "Agent 与工具", en: "Agents & tools", weight: 20 },
  { id: "professional", zh: "专业知识工作", en: "Professional work", weight: 12 },
  { id: "multimodal", zh: "多模态理解", en: "Multimodal", weight: 12 },
  { id: "context", zh: "长上下文与记忆", en: "Long context", weight: 6 },
];

export const BENCHMARKS: BenchmarkRecord[] = [
  { id:"gpqa", name:"GPQA Diamond", axis:"reasoning", mode:"model", tier:"core", method:"exam", unit:"%", version:"Diamond", source:"GPQA", url:"https://arxiv.org/abs/2311.12022", zh:"研究生级科学问答", en:"Graduate-level science reasoning" },
  { id:"hle-no-tools", name:"HLE · no tools", axis:"reasoning", mode:"model", tier:"core", method:"exam", unit:"%", version:"Full", source:"Humanity's Last Exam", url:"https://lastexam.ai/", zh:"无工具前沿知识推理", en:"Frontier knowledge without tools" },
  { id:"hle-tools", name:"HLE · with tools", axis:"agent", mode:"system", tier:"core", method:"exam", unit:"%", version:"Full", source:"Humanity's Last Exam", url:"https://lastexam.ai/", zh:"允许通用工具的 HLE", en:"HLE with general tools" },
  { id:"arc-agi-2", name:"ARC-AGI-2", axis:"reasoning", mode:"model", tier:"core", method:"exam", unit:"%", version:"v2", source:"ARC Prize", url:"https://arcprize.org/arc-agi/2/", zh:"抽象模式与泛化", en:"Abstract pattern generalization" },
  { id:"critpt", name:"CritPt", axis:"math", mode:"model", tier:"core", method:"exam", unit:"%", version:"2026", source:"CritPt", url:"https://critpt.com/", zh:"研究级物理推理", en:"Research-level physics reasoning" },
  { id:"frontiermath", name:"FrontierMath · Tiers 1-3", axis:"math", mode:"model", tier:"core", method:"exam", unit:"%", version:"Tiers 1-3 (v2)", source:"Epoch AI", url:"https://epoch.ai/benchmarks/frontiermath-tiers-1-3-v2", zh:"前沿数学问题（1-3 档）", en:"Frontier mathematics, tiers 1-3" },
  { id:"frontiermath-t4", name:"FrontierMath · Tier 4", axis:"math", mode:"model", tier:"core", method:"exam", unit:"%", version:"Tier 4 (v2)", source:"Epoch AI", url:"https://epoch.ai/benchmarks/frontiermath-tier-4-v2", zh:"前沿数学问题（第 4 档，研究级）", en:"Frontier mathematics, research-level tier 4" },
  { id:"imo-answer", name:"IMOAnswerBench", axis:"math", mode:"model", tier:"core", method:"exam", unit:"%", version:"2026", source:"Open benchmark", url:"https://github.com/GAIR-NLP/IMOAnswerBench", zh:"开放答案奥数推理", en:"Open-answer olympiad reasoning" },
  { id:"deepswe", name:"DeepSWE", axis:"coding", mode:"system", tier:"core", method:"execution", unit:"%", version:"v1.1", source:"DataCurve", url:"https://github.com/datacurve-ai/deep-swe", zh:"原创真实仓库长时程开发", en:"Original long-horizon repository work" },
  { id:"terminal", name:"Terminal-Bench", axis:"coding", mode:"system", tier:"core", method:"execution", unit:"%", version:"2.1", source:"Harbor", url:"https://www.tbench.ai/leaderboard/terminal-bench/2.1", zh:"终端、环境与系统执行", en:"Terminal and systems execution" },
  { id:"terminal-20", name:"Terminal-Bench 2.0", axis:"coding", mode:"system", tier:"legacy", method:"execution", unit:"%", version:"2.0", source:"Harbor", url:"https://www.tbench.ai/leaderboard/terminal-bench/2.0", zh:"终端执行（上一代任务集）", en:"Terminal execution, previous task set" },
  { id:"program", name:"ProgramBench", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"2026", source:"Meta", url:"https://github.com/facebookresearch/programbench", zh:"由二进制与文档重建程序", en:"Rebuild programs from binaries and docs" },
  { id:"swe-pro", name:"SWE-Bench Pro", axis:"coding", mode:"system", tier:"core", method:"execution", unit:"%", version:"2026", source:"Scale AI", url:"https://openreview.net/forum?id=uEVTdoAbnK", zh:"真实代码库问题修复", en:"Real repository issue resolution" },
  { id:"swe-evo", name:"SWE-EVO", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"2026", source:"SWE-EVO", url:"https://github.com/SWE-EVO/SWE-EVO", zh:"跨版本软件演化", en:"Multi-step software evolution" },
  { id:"frontierswe", name:"FrontierSWE", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"2026-07", source:"Proximal", url:"https://www.frontierswe.com/", zh:"前沿复杂工程任务", en:"Frontier engineering tasks" },
  { id:"marathon", name:"SWE-Marathon", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"v1.1", source:"Abundant AI", url:"https://www.swe-marathon.org/", zh:"多小时软件工程任务", en:"Multi-hour software engineering" },
  { id:"posttrain", name:"PostTrainBench", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"v1.1", source:"AISA", url:"https://posttrainbench.com/", zh:"自动化大模型后训练", en:"Autonomous LLM post-training" },
  { id:"scicode", name:"SciCode", axis:"coding", mode:"model", tier:"observe", method:"execution", unit:"%", version:"2026", source:"SciCode", url:"https://scicode-bench.github.io/", zh:"科学研究编程", en:"Scientific research coding" },
  { id:"browsecomp", name:"BrowseComp", axis:"agent", mode:"system", tier:"core", method:"rubric", unit:"%", version:"2026", source:"OpenAI", url:"https://openai.com/index/browsecomp/", zh:"深度搜索与信息检索", en:"Deep web search and retrieval" },
  { id:"mcp-atlas", name:"MCP-Atlas", axis:"agent", mode:"system", tier:"core", method:"rubric", unit:"%", version:"2026", source:"Scale AI", url:"https://github.com/scaleapi/mcp-atlas", zh:"真实 MCP 多工具编排", en:"Real MCP multi-tool workflows" },
  { id:"toolathlon", name:"Toolathlon", axis:"agent", mode:"system", tier:"core", method:"execution", unit:"%", version:"Verified", source:"HKUST", url:"https://github.com/hkust-nlp/Toolathlon", zh:"跨应用长时程工具使用", en:"Long-horizon cross-app tool use" },
  { id:"osworld2", name:"OSWorld 2.0", axis:"agent", mode:"system", tier:"core", method:"execution", unit:"%", version:"2.0", source:"OSWorld", url:"https://os-world.github.io/", zh:"真实电脑操作", en:"Real computer operation" },
  { id:"ale", name:"Agents' Last Exam", axis:"professional", mode:"system", tier:"core", method:"execution", unit:"%", version:"2026", source:"ALE", url:"https://agents-last-exam.org/", zh:"可验证的真实职业任务", en:"Verifiable real-world work" },
  { id:"gdpval", name:"GDPval-AA", axis:"professional", mode:"system", tier:"core", method:"rubric", unit:"Elo", version:"v2", source:"Artificial Analysis", url:"https://artificialanalysis.ai/evaluations/gdpval-aa", zh:"44 种职业的知识工作", en:"Knowledge work across 44 occupations" },
  { id:"apex", name:"APEX-Agents", axis:"professional", mode:"system", tier:"core", method:"rubric", unit:"%", version:"2026", source:"Mercor", url:"https://www.mercor.com/apex/apex-agents-leaderboard/", zh:"投行、咨询与法律交付物", en:"Banking, consulting and legal deliverables" },
  { id:"mmmu", name:"MMMU-Pro", axis:"multimodal", mode:"model", tier:"core", method:"exam", unit:"%", version:"Pro", source:"MMMU", url:"https://mmmu-benchmark.github.io/", zh:"专业多模态推理", en:"Expert multimodal reasoning" },
  { id:"charxiv", name:"CharXiv · RQ", axis:"multimodal", mode:"model", tier:"core", method:"exam", unit:"%", version:"RQ", source:"CharXiv", url:"https://charxiv.github.io/", zh:"复杂学术图表理解", en:"Complex scientific chart reasoning" },
  { id:"omnidoc", name:"OmniDocBench", axis:"multimodal", mode:"model", tier:"observe", method:"execution", unit:"%", version:"1.5", source:"OpenDataLab", url:"https://github.com/opendatalab/OmniDocBench", zh:"真实文档解析", en:"Real-world document parsing" },
  { id:"videommmu", name:"VideoMMMU", axis:"multimodal", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026", source:"VideoMMMU", url:"https://videommmu.github.io/", zh:"专业长视频理解", en:"Expert long-video understanding" },
  { id:"aa-lcr", name:"AA-LCR", axis:"context", mode:"model", tier:"core", method:"exam", unit:"%", version:"2026", source:"Artificial Analysis", url:"https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning", zh:"多文档长上下文推理", en:"Multi-document long-context reasoning" },
  { id:"mrcr", name:"MRCR", axis:"context", mode:"model", tier:"core", method:"exam", unit:"%", version:"v2 · 8 needle", source:"OpenAI", url:"https://huggingface.co/datasets/openai/mrcr", zh:"按上下文长度展示检索曲线", en:"Retrieval curves by context length" },
  { id:"vals-corpfin", name:"Vals · CorpFin v2", axis:"professional", mode:"model", tier:"observe", method:"rubric", unit:"%", version:"v2", source:"Vals AI", url:"https://www.vals.ai/benchmarks/corp_fin_v2", zh:"长上下文信贷协议问答", en:"Credit-agreement finance Q&A" },
  { id:"vals-finance-agent", name:"Vals · Finance Agent v2", axis:"professional", mode:"system", tier:"observe", method:"rubric", unit:"%", version:"v2", source:"Vals AI", url:"https://www.vals.ai/benchmarks/fabv2", zh:"初级金融分析师代理任务", en:"Junior finance-analyst agent tasks" },
  { id:"vals-legal-research", name:"Vals · Legal Research", axis:"professional", mode:"model", tier:"observe", method:"rubric", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/legal_research", zh:"美国法律检索与引证", en:"US legal research and citation" },
  { id:"vals-medscribe", name:"Vals · MedScribe", axis:"professional", mode:"model", tier:"observe", method:"rubric", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/medscribe", zh:"医疗对话转 SOAP 病历", en:"Medical dialogue to SOAP notes" },
  { id:"vals-public-benefits", name:"Vals · Public Benefits", axis:"professional", mode:"system", tier:"observe", method:"rubric", unit:"%", version:"v1.1", source:"Vals AI", url:"https://www.vals.ai/benchmarks/public_benefits", zh:"公共福利资格判定", en:"Public benefits eligibility" },
  { id:"vals-skillsbench", name:"Vals · SkillsBench", axis:"professional", mode:"model", tier:"observe", method:"rubric", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/skillsbench", zh:"跨职业技能评测", en:"Cross-occupation skills" },
  { id:"vals-mortgage-tax", name:"Vals · MortgageTax", axis:"multimodal", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/mortgage_tax", zh:"房产税证明图片字段提取", en:"Property-tax document extraction" },
  { id:"vals-livecodebench", name:"Vals · LiveCodeBench", axis:"coding", mode:"model", tier:"observe", method:"execution", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/livecodebench", zh:"竞赛编程实时题库", en:"Live competitive programming" },
  { id:"vals-ioi", name:"Vals · IOI", axis:"coding", mode:"model", tier:"observe", method:"execution", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/ioi", zh:"信息学奥赛题", en:"Olympiad informatics problems" },
  { id:"vals-code-migration", name:"Vals · Code Migration", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/code_migration", zh:"跨版本代码迁移", en:"Cross-version code migration" },
  { id:"vals-vibe-code-bench", name:"Vals · Vibe Code Bench", axis:"coding", mode:"system", tier:"observe", method:"rubric", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/vibe_code_bench", zh:"从零构建可运行应用", en:"Building working apps from scratch" },
  { id:"vals-proofbench", name:"Vals · ProofBench", axis:"math", mode:"model", tier:"observe", method:"rubric", unit:"%", version:"2026", source:"Vals AI", url:"https://www.vals.ai/benchmarks/proofbench", zh:"数学证明书写", en:"Mathematical proof writing" },
  // LiveBench publishes one column per task and computes its category and Global Average in the
  // browser from those columns. Only the task columns are archived, so only tasks appear here —
  // a category average would be a composite of cells this table already carries, which is the
  // same double-count that dropped vals-index and aa-intelligence-index. Axis follows LiveBench's
  // own category so a reader looking for "Data Analysis" finds all three of its tasks together.
  { id:"livebench-amps-hard", name:"LiveBench · AMPS Hard", axis:"math", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"符号数学求解", en:"Symbolic mathematics" },
  { id:"livebench-integrals-with-game", name:"LiveBench · Integrals with Game", axis:"math", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"积分推导对局", en:"Integral derivation game" },
  { id:"livebench-math-comp", name:"LiveBench · Math Competition", axis:"math", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"数学竞赛题", en:"Competition mathematics" },
  { id:"livebench-olympiad", name:"LiveBench · Olympiad", axis:"math", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"奥数题重排与求解", en:"Olympiad problem solving" },
  { id:"livebench-theory-of-mind", name:"LiveBench · Theory of Mind", axis:"reasoning", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"他人心理状态推断", en:"Reasoning about others' mental states" },
  { id:"livebench-zebra-puzzle", name:"LiveBench · Zebra Puzzle", axis:"reasoning", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"约束满足逻辑谜题", en:"Constraint-satisfaction logic puzzles" },
  { id:"livebench-spatial", name:"LiveBench · Spatial", axis:"reasoning", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"空间关系推理", en:"Spatial relationship reasoning" },
  { id:"livebench-logic-with-navigation", name:"LiveBench · Logic with Navigation", axis:"reasoning", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"路径导航逻辑推理", en:"Navigation-based logical reasoning" },
  { id:"livebench-connections", name:"LiveBench · Connections", axis:"reasoning", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"词语分组联想", en:"Word-grouping association puzzles" },
  { id:"livebench-plot-unscrambling", name:"LiveBench · Plot Unscrambling", axis:"reasoning", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"打乱剧情重排序", en:"Reordering scrambled plot summaries" },
  { id:"livebench-typos", name:"LiveBench · Typos", axis:"reasoning", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"文本错误定位与修正", en:"Locating and correcting text errors" },
  { id:"livebench-code-generation", name:"LiveBench · Code Generation", axis:"coding", mode:"model", tier:"observe", method:"execution", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"竞赛题代码生成", en:"Competition-problem code generation" },
  { id:"livebench-code-completion", name:"LiveBench · Code Completion", axis:"coding", mode:"model", tier:"observe", method:"execution", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"补全缺失代码片段", en:"Completing missing code sections" },
  // LiveBench builds a task-specific Docker image per agentic task, so these are environment
  // results, not single completions. It publishes no scaffold name, so rows carry harness null —
  // permitted because the source class is independent, not benchmark-native.
  { id:"livebench-python", name:"LiveBench · Agentic Python", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"Python 仓库内代理编程", en:"Agentic Python work in a repository" },
  { id:"livebench-javascript", name:"LiveBench · Agentic JavaScript", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"JavaScript 仓库内代理编程", en:"Agentic JavaScript work in a repository" },
  { id:"livebench-typescript", name:"LiveBench · Agentic TypeScript", axis:"coding", mode:"system", tier:"observe", method:"execution", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"TypeScript 仓库内代理编程", en:"Agentic TypeScript work in a repository" },
  { id:"livebench-tablejoin", name:"LiveBench · Table Join", axis:"professional", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"跨表连接与字段对齐", en:"Joining tables and aligning fields" },
  { id:"livebench-tablereformat", name:"LiveBench · Table Reformat", axis:"professional", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"表格格式转换", en:"Converting between table formats" },
  { id:"livebench-consecutive-events", name:"LiveBench · Consecutive Events", axis:"professional", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"时间序列事件抽取", en:"Extracting events from time series" },
  { id:"livebench-summarize", name:"LiveBench · Summarize", axis:"professional", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"按约束生成摘要", en:"Summarising under stated constraints" },
  { id:"livebench-paraphrase", name:"LiveBench · Paraphrase", axis:"professional", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"按约束改写", en:"Paraphrasing under stated constraints" },
  { id:"livebench-simplify", name:"LiveBench · Simplify", axis:"professional", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"按约束简化文本", en:"Simplifying under stated constraints" },
  { id:"livebench-story-generation", name:"LiveBench · Story Generation", axis:"professional", mode:"model", tier:"observe", method:"exam", unit:"%", version:"2026-06-25", source:"LiveBench", url:"https://livebench.ai/", zh:"按约束生成故事", en:"Story writing under stated constraints" },
  { id:"mmlu-pro", name:"MMLU-Pro", axis:"reasoning", mode:"model", tier:"legacy", method:"exam", unit:"%", version:"2025", source:"TIGER-Lab", url:"https://github.com/TIGER-AI-Lab/MMLU-Pro", zh:"历史通用知识覆盖", en:"Historical broad knowledge coverage" },
  { id:"swe-verified", name:"SWE-bench Verified", axis:"coding", mode:"system", tier:"legacy", method:"execution", unit:"%", version:"Verified", source:"SWE-bench", url:"https://www.swebench.com/", zh:"历史软件修复指标", en:"Historical software repair metric" },
];

export type BenchmarkObservation = {
  score: number;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceKind: SourceKind;
  benchmarkVersion: string;
  /** Null when the source publishes no evaluation date; `retrievedDate` then applies. */
  evaluationDate: string | null;
  /** When the row was transcribed. Never presented as an evaluation date. */
  retrievedDate?: string;
  harness: string | null;
  reasoningEffort: string | null;
  toolsEnabled: boolean | null;
  contextLength?: string;
  /** Anything that affects comparability: error bars, subset, pass@k, published model string. */
  note?: string;
};

export type BenchmarkObservations = Record<string, BenchmarkObservation>;
export type BenchmarkScores = Record<string, number>;

const observation = (
  score: number,
  sourceId: string,
  sourceLabel: string,
  sourceUrl: string,
  sourceKind: SourceKind,
  benchmarkVersion: string,
  evaluationDate: string,
  harness: string | null = null,
  reasoningEffort: string | null = null,
  toolsEnabled: boolean | null = null,
  contextLength?: string,
): BenchmarkObservation => ({ score, sourceId, sourceLabel, sourceUrl, sourceKind, benchmarkVersion, evaluationDate, harness, reasoningEffort, toolsEnabled, contextLength });

const KIMI_URL = "https://github.com/MoonshotAI/Kimi-K3";
const GOOGLE_35_URL = "https://deepmind.google/models/model-cards/gemini-3-5-flash/";
const GOOGLE_36_URL = "https://deepmind.google/models/gemini/flash/";
const DEEPSEEK_URL = "https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro";
const DEEPSEEK_FLASH_URL = "https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731";
const DEEPSWE_URL = "https://deepswe.datacurve.ai/";
const GDPVAL_URL = "https://artificialanalysis.ai/evaluations/gdpval-aa";
const QWEN_URL = "https://qwen.ai/blog?id=qwen3.7";

const kimi = (score: number, version: string, harness: string | null = null, reasoningEffort: string | null = null, toolsEnabled: boolean | null = null) =>
  observation(score, "kimi-k3-release", "Kimi K3 release table", KIMI_URL, "vendor", version, "2026-07-23", harness, reasoningEffort, toolsEnabled);
const google35 = (score: number, version: string, harness: string | null = null, toolsEnabled: boolean | null = null, contextLength?: string) =>
  observation(score, "gemini-3.5-card", "Gemini 3.5 Flash model card", GOOGLE_35_URL, "vendor", version, "2026-05-19", harness, "published setting", toolsEnabled, contextLength);
const google36 = (score: number, version: string, harness: string | null = null, toolsEnabled: boolean | null = null, contextLength?: string) =>
  observation(score, "gemini-3.6-release", "Gemini 3.6 Flash release", GOOGLE_36_URL, "vendor", version, "2026-07-31", harness, "published setting", toolsEnabled, contextLength);
const deepseek = (score: number, version: string, harness: string | null = null, toolsEnabled: boolean | null = null, contextLength?: string) =>
  observation(score, "deepseek-v4-card", "DeepSeek V4 model card", DEEPSEEK_URL, "vendor", version, "2026-04-26", harness, "Max", toolsEnabled, contextLength);

// Each value is an observation with its own source, version and execution setup.
// Vendor comparison tables are retained as evidence, but no vendor is the global backbone.
//
// This object is the seed layer only. The canonical store is OBSERVATION_ROWS below,
// which also holds harness/effort variants that cannot fit one value per cell.
const SEED_OBSERVATIONS: Record<string, BenchmarkObservations> = {
  "kimi-k3": { gpqa:kimi(93.5,"Diamond",null,"max",false), critpt:kimi(23.4,"2026",null,"max",false), "aa-lcr":kimi(74.7,"2026",null,"max",false), "hle-no-tools":kimi(43.5,"Full",null,"max",false), "hle-tools":kimi(56,"Full","Kimi Code","max",true), deepswe:kimi(67.5,"v1.1","Kimi Code","max",true), program:kimi(77.8,"2026","Kimi Code","max",true), terminal:kimi(88.3,"2.1","Kimi Code","max",true), frontierswe:kimi(81.2,"2026-07","Kimi Code","max",true), marathon:kimi(42,"v1.1","Kimi Code","max",true), posttrain:kimi(36.6,"v1.1","Kimi Code","max",true), scicode:kimi(58.7,"2026",null,"max",false), browsecomp:kimi(91.2,"2026","search harness","max",true), gdpval:kimi(1686,"v2",null,"max",true), toolathlon:kimi(76.5,"Verified","Kimi Code","max",true), "mcp-atlas":kimi(84.2,"2026",null,"max",true), ale:kimi(28.3,"2026",null,"max",true), apex:kimi(41,"2026",null,"max",true), osworld2:kimi(58.3,"2.0",null,"max",true), omnidoc:kimi(91.1,"1.5",null,"max",false), mmmu:kimi(81.6,"Pro",null,"max",false), charxiv:kimi(84.8,"RQ",null,"max",false) },
  "claude-fable-5": { gpqa:kimi(92.6,"Diamond"), critpt:kimi(28.6,"2026"), "aa-lcr":kimi(70,"2026"), "hle-no-tools":kimi(53.3,"Full"), "hle-tools":kimi(63,"Full",null,null,true), deepswe:kimi(70,"v1.1","Claude Code",null,true), program:kimi(76.8,"2026","Claude Code",null,true), terminal:kimi(88,"2.1","Claude Code",null,true), frontierswe:kimi(86.6,"2026-07","Claude Code",null,true), marathon:kimi(35,"v1.1","Claude Code",null,true), posttrain:kimi(41.4,"v1.1","Claude Code",null,true), scicode:kimi(60.2,"2026"), browsecomp:kimi(88,"2026",null,null,true), gdpval:kimi(1747,"v2",null,null,true), toolathlon:kimi(77.9,"Verified",null,null,true), "mcp-atlas":kimi(84.7,"2026",null,null,true), ale:kimi(25.7,"2026",null,null,true), apex:kimi(43.3,"2026",null,null,true), osworld2:kimi(66.1,"2.0",null,null,true), omnidoc:kimi(89.8,"1.5"), mmmu:kimi(81.2,"Pro"), charxiv:kimi(88.9,"RQ") },
  "gpt-5.6-sol": { gpqa:kimi(94.1,"Diamond"), critpt:kimi(32.3,"2026"), "aa-lcr":kimi(73.7,"2026"), "hle-no-tools":kimi(44.5,"Full"), "hle-tools":kimi(58,"Full",null,null,true), deepswe:kimi(73,"v1.1","Codex",null,true), program:kimi(77.6,"2026","Codex",null,true), terminal:kimi(88.8,"2.1","Codex",null,true), frontierswe:kimi(71.3,"2026-07","Codex",null,true), marathon:kimi(39,"v1.1","Codex",null,true), posttrain:kimi(34.6,"v1.1","Codex",null,true), scicode:kimi(56.1,"2026"), browsecomp:kimi(90.4,"2026",null,null,true), gdpval:kimi(1736,"v2",null,null,true), toolathlon:kimi(74.9,"Verified",null,null,true), "mcp-atlas":kimi(83.6,"2026",null,null,true), ale:kimi(29.6,"2026",null,null,true), apex:kimi(39.9,"2026",null,null,true), osworld2:kimi(62.6,"2.0",null,null,true), omnidoc:kimi(85.8,"1.5"), mmmu:kimi(83,"Pro"), charxiv:kimi(84.6,"RQ") },
  "claude-opus-4.8": { gpqa:kimi(91,"Diamond"), critpt:kimi(20.9,"2026"), "aa-lcr":kimi(67.7,"2026"), "hle-no-tools":kimi(49.8,"Full"), "hle-tools":kimi(57.9,"Full",null,null,true), deepswe:kimi(59,"v1.1","Claude Code",null,true), program:kimi(71.9,"2026","Claude Code",null,true), terminal:kimi(84.6,"2.1","Claude Code",null,true), frontierswe:kimi(66.7,"2026-07","Claude Code",null,true), marathon:kimi(40,"v1.1","Claude Code",null,true), posttrain:kimi(34.1,"v1.1","Claude Code",null,true), scicode:kimi(53.5,"2026"), browsecomp:kimi(84.3,"2026",null,null,true), gdpval:kimi(1593,"v2",null,null,true), toolathlon:kimi(76.2,"Verified",null,null,true), "mcp-atlas":kimi(83.6,"2026",null,null,true), ale:kimi(27,"2026",null,null,true), apex:kimi(39.4,"2026",null,null,true), osworld2:kimi(55.7,"2.0",null,null,true), omnidoc:kimi(87.9,"1.5"), mmmu:kimi(78.9,"Pro"), charxiv:kimi(80.5,"RQ") },
  "gpt-5.5": { gpqa:kimi(93.5,"Diamond"), critpt:kimi(27.1,"2026"), "aa-lcr":kimi(74.3,"2026"), "hle-no-tools":kimi(41.4,"Full"), "hle-tools":kimi(52.2,"Full",null,null,true), deepswe:kimi(67,"v1.1","Codex",null,true), program:kimi(70.8,"2026","Codex",null,true), terminal:kimi(83.4,"2.1","Codex",null,true), frontierswe:kimi(64.9,"2026-07","Codex",null,true), marathon:kimi(14,"v1.1","Codex",null,true), posttrain:kimi(28.4,"v1.1","Codex",null,true), scicode:kimi(56.1,"2026"), browsecomp:kimi(84.4,"2026",null,null,true), gdpval:kimi(1491,"v2",null,null,true), toolathlon:kimi(73.5,"Verified",null,null,true), "mcp-atlas":kimi(82.8,"2026",null,null,true), ale:kimi(26.6,"2026",null,null,true), apex:kimi(38.5,"2026",null,null,true), osworld2:kimi(49.5,"2.0",null,null,true), omnidoc:kimi(89.4,"1.5"), mmmu:kimi(81.2,"Pro"), charxiv:kimi(84.1,"RQ") },
  "glm-5.2": { gpqa:kimi(91.2,"Diamond"), critpt:kimi(20.9,"2026"), "aa-lcr":kimi(71.3,"2026"), deepswe:kimi(46.2,"v1.1",null,null,true), program:kimi(63.7,"2026",null,null,true), terminal:kimi(82.7,"2.1",null,null,true), frontierswe:kimi(67.3,"2026-07",null,null,true), marathon:kimi(13,"v1.1",null,null,true), posttrain:kimi(34.3,"v1.1",null,null,true), scicode:kimi(50.5,"2026"), gdpval:kimi(1510,"v2",null,null,true), toolathlon:kimi(59.9,"Verified",null,null,true), "mcp-atlas":kimi(82.6,"2026",null,null,true), ale:kimi(20.4,"2026",null,null,true), apex:kimi(35.6,"2026",null,null,true) },

  "gemini-3.5-flash": { "hle-no-tools":google35(40.2,"Full",null,false), "arc-agi-2":google35(72.1,"v2",null,false), "swe-pro":google36(55.1,"Public",null,true), deepswe:google36(37,"v1.1",null,true), terminal:google36(76.2,"2.1","Terminus-2",true), gdpval:google36(1349,"v2",null,true), charxiv:google36(84.2,"RQ",null,false), mmmu:google35(83.6,"Pro",null,false), mrcr:google36(77.3,"v2 · 8 needle",null,false,"128K average") },
  "gemini-3.6-flash": { "swe-pro":google36(58.7,"Public",null,true), deepswe:google36(49,"v1.1",null,true), terminal:google36(78,"2.1","Terminus-2",true), gdpval:google36(1421,"v2",null,true), charxiv:google36(85.2,"RQ",null,false), mrcr:google36(91.8,"v2 · 8 needle",null,false,"128K average") },
  "gemini-3.1-pro": { "hle-no-tools":google35(44.4,"Full",null,false), "arc-agi-2":google35(77.1,"v2",null,false), "swe-pro":google36(54.2,"Public",null,true), deepswe:google36(12,"v1.1",null,true), terminal:google36(73.8,"2.1","Terminus-2",true), gdpval:google36(965,"v2",null,true), charxiv:google36(83.3,"RQ",null,false), mmmu:google35(80.5,"Pro",null,false), mrcr:google36(84.9,"v2 · 8 needle",null,false,"128K average") },
  "claude-sonnet-5": { "swe-pro":google36(63.2,"Public",null,true), deepswe:google36(54,"v1.1",null,true), terminal:google36(80.4,"2.1","Terminus-2",true), gdpval:google36(1607,"v2",null,true), charxiv:google36(77,"RQ",null,false), mrcr:google36(71.6,"v2 · 8 needle",null,false,"128K average") },
  "grok-4.5": { "swe-pro":google36(64.7,"Public",null,true), deepswe:google36(54,"v1.1",null,true), terminal:google36(83.3,"2.1","Terminus-2",true), gdpval:google36(1535,"v2",null,true), charxiv:google36(81.6,"RQ",null,false), mrcr:google36(81.4,"v2 · 8 needle",null,false,"128K average") },
  "deepseek-v4-pro": { gpqa:deepseek(90.1,"Diamond",null,false), "hle-no-tools":deepseek(37.7,"Full",null,false), "imo-answer":deepseek(89.8,"2026",null,false), "hle-tools":deepseek(48.2,"Full",null,true), "swe-pro":deepseek(55.4,"2026",null,true), browsecomp:deepseek(83.4,"2026",null,true), "mcp-atlas":deepseek(73.6,"Public",null,true), toolathlon:deepseek(51.8,"Verified",null,true), gdpval:deepseek(1554,"v2",null,true), apex:deepseek(38.3,"2026",null,true), mrcr:deepseek(83.5,"v2 · 8 needle",null,false,"1M") },
  "deepseek-v4-flash": { terminal:observation(82.7,"deepseek-v4-flash-card","DeepSeek V4 Flash 0731 model card",DEEPSEEK_FLASH_URL,"vendor","2.1","2026-07-31",null,"published setting",true), deepswe:observation(54.4,"deepseek-v4-flash-card","DeepSeek V4 Flash 0731 model card",DEEPSEEK_FLASH_URL,"vendor","v1.1","2026-07-31",null,"published setting",true), toolathlon:observation(70.3,"deepseek-v4-flash-card","DeepSeek V4 Flash 0731 model card",DEEPSEEK_FLASH_URL,"vendor","Verified","2026-07-31",null,"published setting",true), ale:observation(25.2,"deepseek-v4-flash-card","DeepSeek V4 Flash 0731 model card",DEEPSEEK_FLASH_URL,"vendor","2026","2026-07-31",null,"published setting",true) },
  "claude-opus-5": { gdpval:observation(1860,"gdpval-aa-v2","GDPval-AA v2 leaderboard",GDPVAL_URL,"independent","v2","2026-07-31",null,"max",true) },
  "qwen3.7-max": { "mcp-atlas":observation(76.4,"qwen3.7-release","Qwen3.7 release",QWEN_URL,"vendor","Public","2026-05-19",null,"published setting",true) },
};

// --- Canonical observation store -------------------------------------------------
// One cell (model × benchmark) can legitimately hold several observations that must
// not be merged: different harness, reasoning effort, tool setting or context length.
// OBSERVATION_ROWS is the source of truth; every other export is derived from it.

export type ObservationRow = BenchmarkObservation & { modelId: string; benchmarkId: string };

const seedRows: ObservationRow[] = Object.entries(SEED_OBSERVATIONS).flatMap(([modelId, values]) =>
  Object.entries(values).map(([benchmarkId, observation]) => ({ ...observation, modelId, benchmarkId })),
);

export const OBSERVATION_ROWS: ObservationRow[] = [...seedRows, ...INGESTED_ROWS];

const SOURCE_RANK: Record<SourceKind, number> = { benchmark: 0, independent: 1, vendor: 2 };
const BENCHMARK_MODE = new Map(BENCHMARKS.map((benchmark) => [benchmark.id, benchmark.mode]));

// Primary = strongest source first. Within one source class, a system benchmark reports the
// best available scaffold, while a model benchmark reports the most recent evaluation.
const byPrimaryPreference = (benchmarkId: string) => (a: ObservationRow, b: ObservationRow) => {
  const rank = SOURCE_RANK[a.sourceKind] - SOURCE_RANK[b.sourceKind];
  if (rank !== 0) return rank;
  if (BENCHMARK_MODE.get(benchmarkId) === "system" && a.score !== b.score) return b.score - a.score;
  const dateA = a.evaluationDate ?? "";
  const dateB = b.evaluationDate ?? "";
  if (dateA !== dateB) return dateA < dateB ? 1 : -1;
  // Effort variants of one model on one date: report its best published configuration.
  return b.score - a.score;
};

export const OBSERVATIONS_BY_CELL: Record<string, Record<string, ObservationRow[]>> = (() => {
  const grouped: Record<string, Record<string, ObservationRow[]>> = {};
  for (const row of OBSERVATION_ROWS) {
    ((grouped[row.modelId] ??= {})[row.benchmarkId] ??= []).push(row);
  }
  for (const [, cells] of Object.entries(grouped)) {
    for (const [benchmarkId, rows] of Object.entries(cells)) rows.sort(byPrimaryPreference(benchmarkId));
  }
  return grouped;
})();

export const BENCHMARK_OBSERVATIONS: Record<string, BenchmarkObservations> = Object.fromEntries(
  Object.entries(OBSERVATIONS_BY_CELL).map(([modelId, cells]) => [
    modelId,
    Object.fromEntries(Object.entries(cells).map(([benchmarkId, rows]) => [benchmarkId, rows[0]])),
  ]),
);

export const BENCHMARK_SCORES: Record<string, BenchmarkScores> = Object.fromEntries(
  Object.entries(BENCHMARK_OBSERVATIONS).map(([modelId, values]) => [modelId, Object.fromEntries(Object.entries(values).map(([benchmarkId, value]) => [benchmarkId, value.score]))]),
);

// The registry declares what a source *is*. Whether it is actually connected is not
// declared - it is measured, by looking for observation rows that came from it. Listing a
// source is not coverage; that confusion is what this dashboard exists to avoid.
//
// `match` is tested against each row's sourceUrl. `feeds` marks a source that legitimately
// supplies something other than observation rows - live pricing, or Arena Elo on the model
// record - and must say what, so it cannot be used to quietly promote an unused source.
const SOURCE_REGISTRY = {
  aa: { label: "Artificial Analysis", date: "31 Jul 2026", url: "https://artificialanalysis.ai/leaderboards/models", role: "independent capability, speed, price and GDPval index", category: "independent", match: "artificialanalysis.ai" },
  arena: { label: "LM Arena", date: "27 Jul 2026", url: "https://arena.ai/leaderboard/text", role: "large-scale human preference signal", category: "preference", match: "lmarena.ai", feeds: "Arena Elo on the model records" },
  vals: { label: "Vals AI", date: "23 Jul 2026", url: "https://www.vals.ai/benchmarks", role: "independent professional-work evaluations", category: "independent", match: "vals.ai" },
  epoch: { label: "Epoch AI", date: "v2 · 2026", url: "https://epoch.ai/frontiermath", role: "FrontierMath and benchmark methodology cross-checks", category: "independent", match: "epoch.ai" },
  arc: { label: "ARC Prize verified", date: "2026", url: "https://arcprize.org/leaderboard", role: "verified ARC-AGI fluid-intelligence results", category: "benchmark", match: "arcprize.org" },
  terminal: { label: "Terminal-Bench", date: "live", url: "https://www.tbench.ai/leaderboard/terminal-bench/2.1", role: "benchmark-native verified terminal-agent runs", category: "benchmark", match: "tbench.ai" },
  deepswe: { label: "DeepSWE official leaderboard", date: "25 Jul 2026", url: DEEPSWE_URL, role: "benchmark-native long-horizon coding runs", category: "benchmark", match: "deepswe.datacurve.ai" },
  scale: { label: "Scale Labs", date: "2026", url: "https://labs.scale.com/leaderboard", role: "MCP-Atlas and SWE-Bench Pro leaderboards", category: "benchmark", match: "labs.scale.com" },
  osworld: { label: "OSWorld 2.0", date: "2026.06", url: "https://osworld-v2.xlang.ai/", role: "execution-based long-horizon computer use", category: "benchmark", match: "osworld" },
  ale: { label: "Agents' Last Exam", date: "2026", url: "https://agents-last-exam.org/leaderboard", role: "verifiable real-world professional tasks", category: "benchmark", match: "agents-last-exam.org" },
  frontierswe: { label: "FrontierSWE", date: "2026-07", url: "https://www.frontierswe.com/", role: "frontier engineering tasks, Mean@5", category: "benchmark", match: "frontierswe.com" },
  apex: { label: "Mercor APEX-Agents", date: "2026", url: "https://www.mercor.com/apex/apex-agents-leaderboard/", role: "banking, consulting and legal deliverables", category: "benchmark", match: "mercor.com" },
  toolathlon: { label: "Toolathlon-Verified", date: "2026", url: "https://github.com/hkust-nlp/Toolathlon", role: "long-horizon cross-application tool use", category: "benchmark", match: "Toolathlon" },
  mmmu: { label: "MMMU", date: "2026", url: "https://mmmu-benchmark.github.io/", role: "expert multimodal reasoning", category: "benchmark", match: "mmmu-benchmark.github.io" },
  swebench: { label: "SWE-bench", date: "live", url: "https://www.swebench.com/", role: "official software-engineering leaderboard and archive", category: "benchmark", match: "swebench.com" },
  livebench: { label: "LiveBench", date: "2026-06-25", url: "https://livebench.ai/", role: "objective, contamination-limited general evaluation", category: "benchmark", match: "livebench.ai" },
  helm: { label: "Stanford HELM", date: "living", url: "https://crfm.stanford.edu/helm/", role: "transparent and reproducible multi-scenario evaluation", category: "independent", match: "crfm.stanford.edu" },
  openrouter: { label: "OpenRouter Models API", date: "live feed", url: "https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties", role: "provider pricing and context-window metadata", category: "pricing", match: "openrouter.ai", feeds: "the live price route" },
  deepmind: { label: "Google DeepMind model cards", date: "31 Jul 2026", url: GOOGLE_36_URL, role: "vendor results with harness notes", category: "vendor", match: "deepmind.google" },
  deepseek: { label: "DeepSeek V4 model cards", date: "31 Jul 2026", url: DEEPSEEK_URL, role: "vendor results with effort modes", category: "vendor", match: "DeepSeek-V4" },
  kimi: { label: "Kimi K3 release table", date: "23 Jul 2026", url: KIMI_URL, role: "comparison seed only, not the global standard", category: "vendor", match: "MoonshotAI/Kimi-K3" },
  qwen: { label: "Qwen3.7 release", date: "19 May 2026", url: QWEN_URL, role: "vendor results with harness notes", category: "vendor", match: "qwen.ai" },
} as const;

export type SourceStatus = "active" | "queued";

export const SOURCE_META = Object.fromEntries(
  Object.entries(SOURCE_REGISTRY).map(([key, entry]) => {
    const observations = OBSERVATION_ROWS.filter((row) => row.sourceUrl.includes(entry.match)).length;
    const feeds = "feeds" in entry ? entry.feeds : null;
    return [key, {
      ...entry,
      observations,
      // Connected means rows in the store, or a stated non-observation contribution.
      status: (observations > 0 || feeds ? "active" : "queued") as SourceStatus,
    }];
  }),
);

