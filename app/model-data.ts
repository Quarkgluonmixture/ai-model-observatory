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
  m("claude-sonnet-5-max", "Claude Sonnet 5 · max", "Anthropic", "#df9a72", false, 1000, 53, 1.72, 79, 155.55, null, 1544, 1, 5, ["coding", "agents", "fast"]),
  m("gpt-5.6-terra-xhigh", "GPT-5.6 Terra · xhigh", "OpenAI", "#e8c36e", false, 1000, 52, 0.43, 111, 12.9, null, null, 2.5, 15, ["fast", "value", "reasoning"]),
  m("glm-5.2-max", "GLM-5.2 · max", "Z.ai", "#177f72", true, 1000, 51, 0.29, 111, 1.43, null, 1588, 1.4, 4.4, ["open weights", "coding", "low latency"]),
  m("muse-spark-1.1", "Muse Spark 1.1", "Meta", "#2d71b9", false, 1050, 51, 0.29, 130, 2.52, 1491, 1536, 1.25, 4.25, ["fast", "creative", "webdev"], true),
  m("gemini-3.5-flash", "Gemini 3.5 Flash", "Google", "#367ed8", false, 1000, 50, 0.69, 172, 22.42, null, null, 0.75, 3.75, ["fast", "vision", "long context"]),
  m("gemini-3.6-flash", "Gemini 3.6 Flash", "Google", "#4e96ed", false, 1000, 50, 0.56, 217, 14.74, 1482, null, 0.75, 3.75, ["very fast", "vision", "arena"], true),
  m("deepseek-v4-flash", "DeepSeek V4 Flash 0731", "DeepSeek", "#6e56c6", true, 1000, 50, 0.03, null, null, null, null, 0.07, 0.11, ["open weights", "extreme value", "new"]),
  m("gemini-3.1-pro", "Gemini 3.1 Pro Preview", "Google", "#2567bd", false, 1000, 46, 0.34, 123, 22.05, 1486, null, 1, 6, ["vision", "arena", "long context"]),
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

export type BenchmarkScores = Record<string, number | null>;

// Public snapshot transcribed from the Kimi K3 release table (23 Jul 2026).
// The table mixes harnesses by design; the UI therefore labels these as best-system results.
export const BENCHMARK_SCORES: Record<string, BenchmarkScores> = {
  "kimi-k3-max": { gpqa:93.5, critpt:23.4, "aa-lcr":74.7, "hle-no-tools":43.5, "hle-tools":56, deepswe:67.5, program:77.8, terminal:88.3, frontierswe:81.2, marathon:42, posttrain:36.6, scicode:58.7, browsecomp:91.2, gdpval:1686, toolathlon:76.5, "mcp-atlas":84.2, ale:28.3, apex:41, osworld2:58.3, omnidoc:91.1, mmmu:81.6, charxiv:84.8 },
  "claude-fable-5": { gpqa:92.6, critpt:28.6, "aa-lcr":70, "hle-no-tools":53.3, "hle-tools":63, deepswe:70, program:76.8, terminal:88, frontierswe:86.6, marathon:35, posttrain:41.4, scicode:60.2, browsecomp:88, gdpval:1747, toolathlon:77.9, "mcp-atlas":84.7, ale:25.7, apex:43.3, osworld2:66.1, omnidoc:89.8, mmmu:81.2, charxiv:88.9 },
  "gpt-5.6-sol-max": { gpqa:94.1, critpt:32.3, "aa-lcr":73.7, "hle-no-tools":44.5, "hle-tools":58, deepswe:73, program:77.6, terminal:88.8, frontierswe:71.3, marathon:39, posttrain:34.6, scicode:56.1, browsecomp:90.4, gdpval:1736, toolathlon:74.9, "mcp-atlas":83.6, ale:29.6, apex:39.9, osworld2:62.6, omnidoc:85.8, mmmu:83, charxiv:84.6 },
  "claude-opus-4.8-max": { gpqa:91, critpt:20.9, "aa-lcr":67.7, "hle-no-tools":49.8, "hle-tools":57.9, deepswe:59, program:71.9, terminal:84.6, frontierswe:66.7, marathon:40, posttrain:34.1, scicode:53.5, browsecomp:84.3, gdpval:1593, toolathlon:76.2, "mcp-atlas":83.6, ale:27, apex:39.4, osworld2:55.7, omnidoc:87.9, mmmu:78.9, charxiv:80.5 },
  "gpt-5.5-xhigh": { gpqa:93.5, critpt:27.1, "aa-lcr":74.3, "hle-no-tools":41.4, "hle-tools":52.2, deepswe:67, program:70.8, terminal:83.4, frontierswe:64.9, marathon:14, posttrain:28.4, scicode:56.1, browsecomp:84.4, gdpval:1491, toolathlon:73.5, "mcp-atlas":82.8, ale:26.6, apex:38.5, osworld2:49.5, omnidoc:89.4, mmmu:81.2, charxiv:84.1 },
  "glm-5.2-max": { gpqa:91.2, critpt:20.9, "aa-lcr":71.3, deepswe:46.2, program:63.7, terminal:82.7, frontierswe:67.3, marathon:13, posttrain:34.3, scicode:50.5, gdpval:1510, toolathlon:59.9, "mcp-atlas":82.6, ale:20.4, apex:35.6 },
};

export const SOURCE_META = {
  aa: { label: "Artificial Analysis", date: "31 Jul 2026", url: "https://artificialanalysis.ai/leaderboards/models" },
  arena: { label: "Arena Text", date: "27 Jul 2026", url: "https://arena.ai/leaderboard/text", votes: "7.50M votes" },
  code: { label: "Code Arena · WebDev", date: "28 Jul 2026", url: "https://arena.ai/leaderboard/code/webdev", votes: "492K votes" },
  kimi: { label: "Kimi K3 release table", date: "23 Jul 2026", url: "https://github.com/MoonshotAI/Kimi-K3" },
  livebench: { label: "LiveBench", date: "25 Jun 2026", url: "https://livebench.ai/" },
};
