export type ModelRecord = {
  id: string;
  name: string;
  maker: string;
  color: string;
  open: boolean;
  contextK: number;
  intelligence: number;
  costTask: number;
  speed: number | null;
  latency: number | null;
  textElo: number | null;
  codeElo: number | null;
  preliminary?: boolean;
  price: { input: number; output: number; cache: number };
  tags: string[];
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

const m = (
  id: string,
  name: string,
  maker: string,
  color: string,
  open: boolean,
  contextK: number,
  intelligence: number,
  costTask: number,
  speed: number | null,
  latency: number | null,
  textElo: number | null,
  codeElo: number | null,
  input: number,
  output: number,
  tags: string[],
  preliminary = false,
): ModelRecord => ({
  id,
  name,
  maker,
  color,
  open,
  contextK,
  intelligence,
  costTask,
  speed,
  latency,
  textElo,
  codeElo,
  preliminary,
  price: { input, output, cache: input / 10 },
  tags,
});

export const MODELS: ModelRecord[] = [
  m("claude-opus-5-max", "Claude Opus 5 · max", "Anthropic", "#c8794d", false, 1000, 61, 2.34, 54, 83.49, 1495, 1712, 5, 25, ["reasoning", "vision", "agents"], true),
  m("claude-opus-5-xhigh", "Claude Opus 5 · xhigh", "Anthropic", "#b7643e", false, 1000, 60, 1.8, 54, 29.85, null, null, 5, 25, ["reasoning", "analysis", "agents"]),
  m("claude-fable-5", "Claude Fable 5 · max", "Anthropic", "#9c4f35", false, 1000, 60, 3.15, 63, 89.02, 1508, 1628, 5, 25, ["knowledge work", "writing", "coding"]),
  m("gpt-5.6-sol-max", "GPT-5.6 Sol · max", "OpenAI", "#bf8b18", false, 1000, 59, 1.86, 66, 147.3, null, null, 5, 30, ["reasoning", "coding", "presentation"]),
  m("claude-opus-5-high", "Claude Opus 5 · high", "Anthropic", "#d18b62", false, 1000, 59, 1.23, 53, 13.3, 1493, 1669, 5, 25, ["reasoning", "webdev", "analysis"]),
  m("gpt-5.6-sol-xhigh", "GPT-5.6 Sol · xhigh", "OpenAI", "#d39a17", false, 1000, 58, 1.17, 61, 48.54, 1485, 1623, 5, 30, ["codex", "agents", "reasoning"]),
  m("kimi-k3-max", "Kimi K3 · max", "Moonshot", "#6d62cf", true, 1050, 57, 0.86, 36, 3.53, 1486, 1682, 3, 15, ["open weights", "webdev", "long context"], true),
  m("gpt-5.6-sol-high", "GPT-5.6 Sol · high", "OpenAI", "#e2aa32", false, 1000, 56, 0.77, 62, 13.25, null, null, 5, 30, ["reasoning", "coding", "efficient"]),
  m("gpt-5.6-terra-max", "GPT-5.6 Terra · max", "OpenAI", "#ecbb55", false, 1000, 55, 0.73, 132, 152.99, null, null, 2.5, 15, ["fast", "reasoning", "multimodal"]),
  m("grok-4.5-high", "Grok 4.5 · high", "xAI", "#42576b", false, 500, 54, 0.44, 58, 8.01, null, 1550, 2, 6, ["coding", "reasoning", "realtime"]),
  m("claude-sonnet-5-max", "Claude Sonnet 5 · max", "Anthropic", "#df9a72", false, 1000, 53, 1.72, 79, 155.55, null, 1544, 3, 15, ["coding", "agents", "fast"]),
  m("gpt-5.6-terra-xhigh", "GPT-5.6 Terra · xhigh", "OpenAI", "#e8c36e", false, 1000, 52, 0.43, 111, 12.9, null, null, 2.5, 15, ["fast", "value", "reasoning"]),
  m("glm-5.2-max", "GLM-5.2 · max", "Z.ai", "#177f72", true, 1000, 51, 0.29, 111, 1.43, null, 1588, 1.4, 4.4, ["open weights", "coding", "low latency"]),
  m("muse-spark-1.1", "Muse Spark 1.1", "Meta", "#2d71b9", false, 1050, 51, 0.29, 130, 2.52, 1491, 1536, 1.25, 4.25, ["fast", "creative", "webdev"], true),
  m("gemini-3.5-flash", "Gemini 3.5 Flash", "Google", "#367ed8", false, 1000, 50, 0.69, 172, 22.42, null, null, 1.5, 9, ["fast", "vision", "long context"]),
  m("gemini-3.6-flash", "Gemini 3.6 Flash", "Google", "#4e96ed", false, 1000, 50, 0.56, 217, 14.74, 1482, null, 1.5, 7.5, ["very fast", "vision", "arena"], true),
  m("deepseek-v4-flash", "DeepSeek V4 Flash 0731", "DeepSeek", "#6e56c6", true, 1000, 50, 0.03, null, null, null, null, 0.07, 0.11, ["open weights", "extreme value", "new"]),
  m("gemini-3.1-pro", "Gemini 3.1 Pro Preview", "Google", "#2567bd", false, 1000, 46, 0.34, 123, 22.05, 1486, null, 2, 12, ["vision", "arena", "long context"]),
  m("qwen3.7-max", "Qwen3.7 Max", "Alibaba", "#358a9a", true, 1000, 46, 1.28, 200, 2.41, null, null, 1.2, 6, ["open weights", "fast", "multilingual"]),
  m("deepseek-v4-pro", "DeepSeek V4 Pro · max", "DeepSeek", "#8467d6", true, 1000, 44, 0.05, 65, 1.64, null, null, 0.14, 0.28, ["open weights", "value", "reasoning"]),
  m("claude-opus-4.8-max", "Claude Opus 4.8 · max", "Anthropic", "#a35f42", false, 1000, 52, 1.36, 48, 18.4, 1478, 1598, 5, 25, ["reasoning", "coding", "agents"]),
  m("gpt-5.5-xhigh", "GPT-5.5 · xhigh", "OpenAI", "#8d751e", false, 1000, 51, 0.91, 71, 20.1, 1469, 1585, 2.5, 15, ["reasoning", "codex", "long context"]),
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
  { id:"frontiermath", name:"FrontierMath", axis:"math", mode:"model", tier:"core", method:"exam", unit:"%", version:"2026", source:"Epoch AI", url:"https://epoch.ai/frontiermath", zh:"前沿数学问题", en:"Frontier mathematics" },
  { id:"imo-answer", name:"IMOAnswerBench", axis:"math", mode:"model", tier:"core", method:"exam", unit:"%", version:"2026", source:"Open benchmark", url:"https://github.com/GAIR-NLP/IMOAnswerBench", zh:"开放答案奥数推理", en:"Open-answer olympiad reasoning" },
  { id:"deepswe", name:"DeepSWE", axis:"coding", mode:"system", tier:"core", method:"execution", unit:"%", version:"v1.1", source:"DataCurve", url:"https://github.com/datacurve-ai/deep-swe", zh:"原创真实仓库长时程开发", en:"Original long-horizon repository work" },
  { id:"terminal", name:"Terminal-Bench", axis:"coding", mode:"system", tier:"core", method:"execution", unit:"%", version:"2.1", source:"Harbor", url:"https://www.tbench.ai/leaderboard/terminal-bench/2.1", zh:"终端、环境与系统执行", en:"Terminal and systems execution" },
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
  evaluationDate: string;
  harness: string | null;
  reasoningEffort: string | null;
  toolsEnabled: boolean | null;
  contextLength?: string;
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
export const BENCHMARK_OBSERVATIONS: Record<string, BenchmarkObservations> = {
  "kimi-k3-max": { gpqa:kimi(93.5,"Diamond",null,"max",false), critpt:kimi(23.4,"2026",null,"max",false), "aa-lcr":kimi(74.7,"2026",null,"max",false), "hle-no-tools":kimi(43.5,"Full",null,"max",false), "hle-tools":kimi(56,"Full","Kimi Code","max",true), deepswe:kimi(67.5,"v1.1","Kimi Code","max",true), program:kimi(77.8,"2026","Kimi Code","max",true), terminal:kimi(88.3,"2.1","Kimi Code","max",true), frontierswe:kimi(81.2,"2026-07","Kimi Code","max",true), marathon:kimi(42,"v1.1","Kimi Code","max",true), posttrain:kimi(36.6,"v1.1","Kimi Code","max",true), scicode:kimi(58.7,"2026",null,"max",false), browsecomp:kimi(91.2,"2026","search harness","max",true), gdpval:kimi(1686,"v2",null,"max",true), toolathlon:kimi(76.5,"Verified","Kimi Code","max",true), "mcp-atlas":kimi(84.2,"2026",null,"max",true), ale:kimi(28.3,"2026",null,"max",true), apex:kimi(41,"2026",null,"max",true), osworld2:kimi(58.3,"2.0",null,"max",true), omnidoc:kimi(91.1,"1.5",null,"max",false), mmmu:kimi(81.6,"Pro",null,"max",false), charxiv:kimi(84.8,"RQ",null,"max",false) },
  "claude-fable-5": { gpqa:kimi(92.6,"Diamond"), critpt:kimi(28.6,"2026"), "aa-lcr":kimi(70,"2026"), "hle-no-tools":kimi(53.3,"Full"), "hle-tools":kimi(63,"Full",null,null,true), deepswe:kimi(70,"v1.1","Claude Code",null,true), program:kimi(76.8,"2026","Claude Code",null,true), terminal:kimi(88,"2.1","Claude Code",null,true), frontierswe:kimi(86.6,"2026-07","Claude Code",null,true), marathon:kimi(35,"v1.1","Claude Code",null,true), posttrain:kimi(41.4,"v1.1","Claude Code",null,true), scicode:kimi(60.2,"2026"), browsecomp:kimi(88,"2026",null,null,true), gdpval:kimi(1747,"v2",null,null,true), toolathlon:kimi(77.9,"Verified",null,null,true), "mcp-atlas":kimi(84.7,"2026",null,null,true), ale:kimi(25.7,"2026",null,null,true), apex:kimi(43.3,"2026",null,null,true), osworld2:kimi(66.1,"2.0",null,null,true), omnidoc:kimi(89.8,"1.5"), mmmu:kimi(81.2,"Pro"), charxiv:kimi(88.9,"RQ") },
  "gpt-5.6-sol-max": { gpqa:kimi(94.1,"Diamond"), critpt:kimi(32.3,"2026"), "aa-lcr":kimi(73.7,"2026"), "hle-no-tools":kimi(44.5,"Full"), "hle-tools":kimi(58,"Full",null,null,true), deepswe:kimi(73,"v1.1","Codex",null,true), program:kimi(77.6,"2026","Codex",null,true), terminal:kimi(88.8,"2.1","Codex",null,true), frontierswe:kimi(71.3,"2026-07","Codex",null,true), marathon:kimi(39,"v1.1","Codex",null,true), posttrain:kimi(34.6,"v1.1","Codex",null,true), scicode:kimi(56.1,"2026"), browsecomp:kimi(90.4,"2026",null,null,true), gdpval:kimi(1736,"v2",null,null,true), toolathlon:kimi(74.9,"Verified",null,null,true), "mcp-atlas":kimi(83.6,"2026",null,null,true), ale:kimi(29.6,"2026",null,null,true), apex:kimi(39.9,"2026",null,null,true), osworld2:kimi(62.6,"2.0",null,null,true), omnidoc:kimi(85.8,"1.5"), mmmu:kimi(83,"Pro"), charxiv:kimi(84.6,"RQ") },
  "claude-opus-4.8-max": { gpqa:kimi(91,"Diamond"), critpt:kimi(20.9,"2026"), "aa-lcr":kimi(67.7,"2026"), "hle-no-tools":kimi(49.8,"Full"), "hle-tools":kimi(57.9,"Full",null,null,true), deepswe:kimi(59,"v1.1","Claude Code",null,true), program:kimi(71.9,"2026","Claude Code",null,true), terminal:kimi(84.6,"2.1","Claude Code",null,true), frontierswe:kimi(66.7,"2026-07","Claude Code",null,true), marathon:kimi(40,"v1.1","Claude Code",null,true), posttrain:kimi(34.1,"v1.1","Claude Code",null,true), scicode:kimi(53.5,"2026"), browsecomp:kimi(84.3,"2026",null,null,true), gdpval:kimi(1593,"v2",null,null,true), toolathlon:kimi(76.2,"Verified",null,null,true), "mcp-atlas":kimi(83.6,"2026",null,null,true), ale:kimi(27,"2026",null,null,true), apex:kimi(39.4,"2026",null,null,true), osworld2:kimi(55.7,"2.0",null,null,true), omnidoc:kimi(87.9,"1.5"), mmmu:kimi(78.9,"Pro"), charxiv:kimi(80.5,"RQ") },
  "gpt-5.5-xhigh": { gpqa:kimi(93.5,"Diamond"), critpt:kimi(27.1,"2026"), "aa-lcr":kimi(74.3,"2026"), "hle-no-tools":kimi(41.4,"Full"), "hle-tools":kimi(52.2,"Full",null,null,true), deepswe:kimi(67,"v1.1","Codex",null,true), program:kimi(70.8,"2026","Codex",null,true), terminal:kimi(83.4,"2.1","Codex",null,true), frontierswe:kimi(64.9,"2026-07","Codex",null,true), marathon:kimi(14,"v1.1","Codex",null,true), posttrain:kimi(28.4,"v1.1","Codex",null,true), scicode:kimi(56.1,"2026"), browsecomp:kimi(84.4,"2026",null,null,true), gdpval:kimi(1491,"v2",null,null,true), toolathlon:kimi(73.5,"Verified",null,null,true), "mcp-atlas":kimi(82.8,"2026",null,null,true), ale:kimi(26.6,"2026",null,null,true), apex:kimi(38.5,"2026",null,null,true), osworld2:kimi(49.5,"2.0",null,null,true), omnidoc:kimi(89.4,"1.5"), mmmu:kimi(81.2,"Pro"), charxiv:kimi(84.1,"RQ") },
  "glm-5.2-max": { gpqa:kimi(91.2,"Diamond"), critpt:kimi(20.9,"2026"), "aa-lcr":kimi(71.3,"2026"), deepswe:kimi(46.2,"v1.1",null,null,true), program:kimi(63.7,"2026",null,null,true), terminal:kimi(82.7,"2.1",null,null,true), frontierswe:kimi(67.3,"2026-07",null,null,true), marathon:kimi(13,"v1.1",null,null,true), posttrain:kimi(34.3,"v1.1",null,null,true), scicode:kimi(50.5,"2026"), gdpval:kimi(1510,"v2",null,null,true), toolathlon:kimi(59.9,"Verified",null,null,true), "mcp-atlas":kimi(82.6,"2026",null,null,true), ale:kimi(20.4,"2026",null,null,true), apex:kimi(35.6,"2026",null,null,true) },

  "gemini-3.5-flash": { "hle-no-tools":google35(40.2,"Full",null,false), "arc-agi-2":google35(72.1,"v2",null,false), "swe-pro":google36(55.1,"Public",null,true), deepswe:google36(37,"v1.1",null,true), terminal:google36(76.2,"2.1","Terminus-2",true), gdpval:google36(1349,"v2",null,true), charxiv:google36(84.2,"RQ",null,false), mmmu:google35(83.6,"Pro",null,false), mrcr:google36(77.3,"v2 · 8 needle",null,false,"128K average") },
  "gemini-3.6-flash": { "swe-pro":google36(58.7,"Public",null,true), deepswe:google36(49,"v1.1",null,true), terminal:google36(78,"2.1","Terminus-2",true), gdpval:google36(1421,"v2",null,true), charxiv:google36(85.2,"RQ",null,false), mrcr:google36(91.8,"v2 · 8 needle",null,false,"128K average") },
  "gemini-3.1-pro": { "hle-no-tools":google35(44.4,"Full",null,false), "arc-agi-2":google35(77.1,"v2",null,false), "swe-pro":google36(54.2,"Public",null,true), deepswe:google36(12,"v1.1",null,true), terminal:google36(73.8,"2.1","Terminus-2",true), gdpval:google36(965,"v2",null,true), charxiv:google36(83.3,"RQ",null,false), mmmu:google35(80.5,"Pro",null,false), mrcr:google36(84.9,"v2 · 8 needle",null,false,"128K average") },
  "claude-sonnet-5-max": { "swe-pro":google36(63.2,"Public",null,true), deepswe:google36(54,"v1.1",null,true), terminal:google36(80.4,"2.1","Terminus-2",true), gdpval:google36(1607,"v2",null,true), charxiv:google36(77,"RQ",null,false), mrcr:google36(71.6,"v2 · 8 needle",null,false,"128K average") },
  "grok-4.5-high": { "swe-pro":google36(64.7,"Public",null,true), deepswe:google36(54,"v1.1",null,true), terminal:google36(83.3,"2.1","Terminus-2",true), gdpval:google36(1535,"v2",null,true), charxiv:google36(81.6,"RQ",null,false), mrcr:google36(81.4,"v2 · 8 needle",null,false,"128K average") },
  "deepseek-v4-pro": { gpqa:deepseek(90.1,"Diamond",null,false), "hle-no-tools":deepseek(37.7,"Full",null,false), "imo-answer":deepseek(89.8,"2026",null,false), "hle-tools":deepseek(48.2,"Full",null,true), "swe-pro":deepseek(55.4,"2026",null,true), browsecomp:deepseek(83.4,"2026",null,true), "mcp-atlas":deepseek(73.6,"Public",null,true), toolathlon:deepseek(51.8,"Verified",null,true), gdpval:deepseek(1554,"v2",null,true), apex:deepseek(38.3,"2026",null,true), mrcr:deepseek(83.5,"v2 · 8 needle",null,false,"1M") },
  "deepseek-v4-flash": { terminal:observation(82.7,"deepseek-v4-flash-card","DeepSeek V4 Flash 0731 model card",DEEPSEEK_FLASH_URL,"vendor","2.1","2026-07-31",null,"published setting",true), deepswe:observation(54.4,"deepseek-v4-flash-card","DeepSeek V4 Flash 0731 model card",DEEPSEEK_FLASH_URL,"vendor","v1.1","2026-07-31",null,"published setting",true), toolathlon:observation(70.3,"deepseek-v4-flash-card","DeepSeek V4 Flash 0731 model card",DEEPSEEK_FLASH_URL,"vendor","Verified","2026-07-31",null,"published setting",true), ale:observation(25.2,"deepseek-v4-flash-card","DeepSeek V4 Flash 0731 model card",DEEPSEEK_FLASH_URL,"vendor","2026","2026-07-31",null,"published setting",true) },
  "claude-opus-5-max": { deepswe:observation(74,"deepswe-v1.1","DeepSWE leaderboard",DEEPSWE_URL,"benchmark","v1.1","2026-07-25","public leaderboard","max",true), gdpval:observation(1860,"gdpval-aa-v2","GDPval-AA v2 leaderboard",GDPVAL_URL,"independent","v2","2026-07-31",null,"max",true) },
  "qwen3.7-max": { "mcp-atlas":observation(76.4,"qwen3.7-release","Qwen3.7 release",QWEN_URL,"vendor","Public","2026-05-19",null,"published setting",true) },
};

export const BENCHMARK_SCORES: Record<string, BenchmarkScores> = Object.fromEntries(
  Object.entries(BENCHMARK_OBSERVATIONS).map(([modelId, values]) => [modelId, Object.fromEntries(Object.entries(values).map(([benchmarkId, value]) => [benchmarkId, value.score]))]),
);

export const SOURCE_META = {
  aa: { label: "Artificial Analysis", date: "31 Jul 2026", url: "https://artificialanalysis.ai/leaderboards/models", role: "independent index + GDPval" },
  arena: { label: "Arena Text", date: "27 Jul 2026", url: "https://arena.ai/leaderboard/text", votes: "7.50M votes", role: "human preference" },
  deepmind: { label: "Google DeepMind model cards", date: "31 Jul 2026", url: GOOGLE_36_URL, role: "vendor results + harness notes" },
  deepseek: { label: "DeepSeek V4 model cards", date: "31 Jul 2026", url: DEEPSEEK_URL, role: "vendor results + effort modes" },
  deepswe: { label: "DeepSWE official leaderboard", date: "25 Jul 2026", url: DEEPSWE_URL, role: "benchmark-native leaderboard" },
  kimi: { label: "Kimi K3 release table", date: "23 Jul 2026", url: KIMI_URL, role: "comparison seed, not global standard" },
  qwen: { label: "Qwen3.7 release", date: "19 May 2026", url: QWEN_URL, role: "vendor results + harness notes" },
};
