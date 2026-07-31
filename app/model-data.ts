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

export const MODELS: ModelRecord[] = [
  { id:"claude-opus-5-max", name:"Claude Opus 5 · max", maker:"Anthropic", color:"#c8794d", open:false, contextK:1000, intelligence:61, costTask:2.34, speed:54, latency:83.49, textElo:1495, codeElo:1712, preliminary:true, price:{input:5,output:25,cache:.5}, tags:["reasoning","vision","agents"] },
  { id:"claude-opus-5-xhigh", name:"Claude Opus 5 · xhigh", maker:"Anthropic", color:"#b7643e", open:false, contextK:1000, intelligence:60, costTask:1.80, speed:54, latency:29.85, textElo:null, codeElo:null, price:{input:5,output:25,cache:.5}, tags:["reasoning","analysis","agents"] },
  { id:"claude-fable-5", name:"Claude Fable 5", maker:"Anthropic", color:"#9c4f35", open:false, contextK:1000, intelligence:60, costTask:3.15, speed:63, latency:89.02, textElo:1508, codeElo:1628, price:{input:5,output:25,cache:.5}, tags:["knowledge work","writing","coding"] },
  { id:"gpt-5.6-sol-max", name:"GPT-5.6 Sol · max", maker:"OpenAI", color:"#bf8b18", open:false, contextK:1000, intelligence:59, costTask:1.86, speed:66, latency:147.30, textElo:null, codeElo:null, price:{input:5,output:30,cache:.5}, tags:["reasoning","coding","presentation"] },
  { id:"claude-opus-5-high", name:"Claude Opus 5 · high", maker:"Anthropic", color:"#d18b62", open:false, contextK:1000, intelligence:59, costTask:1.23, speed:53, latency:13.30, textElo:1493, codeElo:1669, price:{input:5,output:25,cache:.5}, tags:["reasoning","webdev","analysis"] },
  { id:"gpt-5.6-sol-xhigh", name:"GPT-5.6 Sol · xhigh", maker:"OpenAI", color:"#d39a17", open:false, contextK:1000, intelligence:58, costTask:1.17, speed:61, latency:48.54, textElo:1485, codeElo:1623, price:{input:5,output:30,cache:.5}, tags:["codex","agents","reasoning"] },
  { id:"kimi-k3-max", name:"Kimi K3 · max", maker:"Moonshot", color:"#6d62cf", open:true, contextK:1050, intelligence:57, costTask:.86, speed:36, latency:3.53, textElo:1486, codeElo:1682, preliminary:true, price:{input:3,output:15,cache:.3}, tags:["open weights","webdev","long context"] },
  { id:"gpt-5.6-sol-high", name:"GPT-5.6 Sol · high", maker:"OpenAI", color:"#e2aa32", open:false, contextK:1000, intelligence:56, costTask:.77, speed:62, latency:13.25, textElo:null, codeElo:null, price:{input:5,output:30,cache:.5}, tags:["reasoning","coding","efficient"] },
  { id:"gpt-5.6-terra-max", name:"GPT-5.6 Terra · max", maker:"OpenAI", color:"#ecbb55", open:false, contextK:1000, intelligence:55, costTask:.73, speed:132, latency:152.99, textElo:null, codeElo:null, price:{input:2.5,output:15,cache:.25}, tags:["fast","reasoning","multimodal"] },
  { id:"grok-4.5-high", name:"Grok 4.5 · high", maker:"xAI", color:"#42576b", open:false, contextK:500, intelligence:54, costTask:.44, speed:58, latency:8.01, textElo:null, codeElo:1550, price:{input:2,output:6,cache:.2}, tags:["coding","reasoning","realtime"] },
  { id:"claude-sonnet-5-max", name:"Claude Sonnet 5 · max", maker:"Anthropic", color:"#df9a72", open:false, contextK:1000, intelligence:53, costTask:1.72, speed:79, latency:155.55, textElo:null, codeElo:1544, price:{input:1,output:5,cache:.1}, tags:["coding","agents","fast"] },
  { id:"gpt-5.6-terra-xhigh", name:"GPT-5.6 Terra · xhigh", maker:"OpenAI", color:"#e8c36e", open:false, contextK:1000, intelligence:52, costTask:.43, speed:111, latency:12.90, textElo:null, codeElo:null, price:{input:2.5,output:15,cache:.25}, tags:["fast","value","reasoning"] },
  { id:"glm-5.2-max", name:"GLM-5.2 · max", maker:"Z.ai", color:"#177f72", open:true, contextK:1000, intelligence:51, costTask:.29, speed:111, latency:1.43, textElo:null, codeElo:1588, price:{input:1.4,output:4.4,cache:.14}, tags:["open weights","coding","low latency"] },
  { id:"muse-spark-1.1", name:"Muse Spark 1.1", maker:"Meta", color:"#2d71b9", open:false, contextK:1050, intelligence:51, costTask:.29, speed:130, latency:2.52, textElo:1491, codeElo:1536, preliminary:true, price:{input:1.25,output:4.25,cache:.13}, tags:["fast","creative","webdev"] },
  { id:"gemini-3.5-flash", name:"Gemini 3.5 Flash", maker:"Google", color:"#367ed8", open:false, contextK:1000, intelligence:50, costTask:.69, speed:172, latency:22.42, textElo:null, codeElo:null, price:{input:.75,output:3.75,cache:.075}, tags:["fast","vision","long context"] },
  { id:"gemini-3.6-flash", name:"Gemini 3.6 Flash", maker:"Google", color:"#4e96ed", open:false, contextK:1000, intelligence:50, costTask:.56, speed:217, latency:14.74, textElo:1482, codeElo:null, preliminary:true, price:{input:.75,output:3.75,cache:.075}, tags:["very fast","vision","arena"] },
  { id:"deepseek-v4-flash", name:"DeepSeek V4 Flash 0731", maker:"DeepSeek", color:"#6e56c6", open:true, contextK:1000, intelligence:50, costTask:.03, speed:null, latency:null, textElo:null, codeElo:null, price:{input:.07,output:.11,cache:.014}, tags:["open weights","extreme value","new"] },
  { id:"gemini-3.1-pro", name:"Gemini 3.1 Pro Preview", maker:"Google", color:"#2567bd", open:false, contextK:1000, intelligence:46, costTask:.34, speed:123, latency:22.05, textElo:1486, codeElo:null, price:{input:1,output:6,cache:.1}, tags:["vision","arena","long context"] },
  { id:"qwen3.7-max", name:"Qwen3.7 Max", maker:"Alibaba", color:"#358a9a", open:true, contextK:1000, intelligence:46, costTask:1.28, speed:200, latency:2.41, textElo:null, codeElo:null, price:{input:1.2,output:6,cache:.12}, tags:["open weights","fast","multilingual"] },
  { id:"deepseek-v4-pro", name:"DeepSeek V4 Pro · max", maker:"DeepSeek", color:"#8467d6", open:true, contextK:1000, intelligence:44, costTask:.05, speed:65, latency:1.64, textElo:null, codeElo:null, price:{input:.14,output:.28,cache:.028}, tags:["open weights","value","reasoning"] },
];

export const SOURCE_META = {
  aa: { label: "Artificial Analysis", date: "31 Jul 2026", url: "https://artificialanalysis.ai/leaderboards/models" },
  arena: { label: "Arena Text", date: "27 Jul 2026", url: "https://arena.ai/leaderboard/text", votes: "7.50M votes" },
  code: { label: "Code Arena · WebDev", date: "28 Jul 2026", url: "https://arena.ai/leaderboard/code/webdev", votes: "492K votes" },
  livebench: { label: "LiveBench", date: "25 Jun 2026", url: "https://livebench.ai/" },
};
