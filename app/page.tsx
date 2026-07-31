"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AXES,
  BENCHMARKS,
  BENCHMARK_OBSERVATIONS,
  BENCHMARK_SCORES,
  MODELS,
  SOURCE_META,
  type BenchmarkAxis,
  type BenchmarkMode,
  type BenchmarkRecord,
  type ModelRecord,
} from "./model-data";

type Lang = "zh" | "en";
type RankLens = "intelligence" | "agent" | "preference" | "coding" | "speed" | "value";

const UI = {
  zh: {
    eyebrow: "前沿智能 · 版本化观测",
    brand: "AI 模型观测站",
    search: "搜索模型或实验室",
    snapshot: "数据快照",
    live: "价格已更新",
    tracked: "收录模型",
    portfolio: "Benchmark 目录",
    ranking: "前沿模型排行",
    rankingDesc: "能力、系统表现与人工偏好分开排序，避免把不同评价对象混成一个总分。",
    allLabs: "全部实验室",
    open: "仅开放权重",
    show: "显示全部模型",
    hide: "收起至前 10 名",
    compare: "对比",
    current: "当前视图",
    capability: "七维能力画像",
    capabilityDesc: "雷达图只使用有公开分数的能力轴；缺失数据保持 N/A，不做补零或估算。",
    controlled: "模型能力",
    best: "最佳系统",
    controlledNote: "优先单轮、无工具或统一设置的结果",
    bestNote: "允许模型使用公开最佳 Agent scaffold 与工具",
    coverage: "数据覆盖",
    notIngested: "尚未接入",
    partialCoverage: "部分覆盖",
    broadCoverage: "广泛覆盖",
    coreMetrics: "项核心指标",
    observations: "条公开观测",
    noRadar: "该模型尚无足够的兼容 Benchmark 数据",
    benchmark: "Benchmark 组合面板",
    benchmarkDesc: "按能力族查看原始分数、版本、评测对象与评分方法；最多对比三个模型。",
    catalog: "评测目录",
    catalogDesc: "核心指标进入能力面板；观察指标先展示、不计综合排行；历史指标仅作趋势参考。",
    core: "核心",
    observe: "观察",
    legacy: "历史",
    modelMode: "模型",
    systemMode: "系统",
    exec: "执行验证",
    exam: "标准答案",
    rubric: "规则评审",
    preference: "人工偏好",
    pricing: "Token 价格",
    pricingDesc: "每百万 Token 的供应商价格；实时匹配失败时保留最近快照。",
    input: "输入",
    output: "输出",
    blended: "7:2:1 混合价",
    sources: "数据来源与可比性",
    sourceNote: "“已接入”表示当前页面确实使用了该来源的数据；“接入队列”只是下一批采集目标，不参与现有分数。Arena 衡量人工偏好，系统类结果还同时反映 harness、工具与预算。",
    back: "返回排行 ↑",
    unavailable: "N/A",
    updated: "更新于 2026 年 7 月 31 日",
  },
  en: {
    eyebrow: "Frontier intelligence · versioned evidence",
    brand: "AI Model Observatory",
    search: "Search model or lab",
    snapshot: "Snapshot",
    live: "Prices updated",
    tracked: "Tracked models",
    portfolio: "Benchmarks catalogued",
    ranking: "Frontier model ranking",
    rankingDesc: "Capability, system performance and human preference stay separate instead of collapsing into one score.",
    allLabs: "All labs",
    open: "Open weights only",
    show: "Show all models",
    hide: "Show top 10",
    compare: "Compare",
    current: "Current lens",
    capability: "Seven-axis capability profile",
    capabilityDesc: "Radar axes use published scores only. Missing evidence remains N/A—never zero-filled or estimated.",
    controlled: "Model capability",
    best: "Best system",
    controlledNote: "Prioritises single-step, no-tool or controlled results",
    bestNote: "Allows each model's strongest public agent scaffold and tools",
    coverage: "Coverage",
    notIngested: "Not ingested",
    partialCoverage: "Partial",
    broadCoverage: "Broad",
    coreMetrics: "core metrics",
    observations: "public observations",
    noRadar: "Not enough compatible benchmark evidence for this model yet",
    benchmark: "Benchmark portfolio",
    benchmarkDesc: "Inspect raw scores, versions, evaluated object and scoring method by capability family. Compare up to three models.",
    catalog: "Evaluation catalog",
    catalogDesc: "Core metrics feed capability views; observe metrics remain visible but unscored; legacy metrics provide history only.",
    core: "Core",
    observe: "Observe",
    legacy: "Legacy",
    modelMode: "Model",
    systemMode: "System",
    exec: "Execution",
    exam: "Answer key",
    rubric: "Rubric / judge",
    preference: "Human preference",
    pricing: "Token economics",
    pricingDesc: "Provider price per million tokens; the latest snapshot remains if live matching fails.",
    input: "Input",
    output: "Output",
    blended: "7:2:1 blended",
    sources: "Sources and comparability",
    sourceNote: "Connected sources currently feed this dashboard. Queued sources are ingestion targets only and do not affect existing scores. Arena measures preference; system results also reflect harness, tools and budget.",
    back: "Back to ranking ↑",
    unavailable: "N/A",
    updated: "Updated 31 Jul 2026",
  },
};

const LENSES: { id: RankLens; zh: string; en: string; shortZh: string; shortEn: string }[] = [
  { id:"intelligence", zh:"综合能力", en:"General capability", shortZh:"综合", shortEn:"General" },
  { id:"agent", zh:"Agent 系统", en:"Agent system", shortZh:"Agent", shortEn:"Agent" },
  { id:"coding", zh:"编程系统", en:"Coding system", shortZh:"编程", shortEn:"Coding" },
  { id:"preference", zh:"人类偏好", en:"Human preference", shortZh:"偏好", shortEn:"Preference" },
  { id:"speed", zh:"输出速度", en:"Output speed", shortZh:"速度", shortEn:"Speed" },
  { id:"value", zh:"单任务性价比", en:"Value / task", shortZh:"性价比", shortEn:"Value" },
];

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const formatUsd = (value: number) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: value < 0.01 ? 6 : value < 1 ? 4 : 2,
}).format(value);
const normalized = (b: BenchmarkRecord, value: number) => b.unit === "Elo" ? clamp((value - 1000) / 8) : clamp(value);
const scoresFor = (modelId: string) => BENCHMARK_SCORES[modelId] ?? {};
const observationsFor = (modelId: string) => BENCHMARK_OBSERVATIONS[modelId] ?? {};

function axisScore(modelId: string, axis: BenchmarkAxis, mode: BenchmarkMode) {
  const scores = scoresFor(modelId);
  const candidates = BENCHMARKS.filter(b => b.axis === axis && b.tier === "core" && (mode === "system" || b.mode === "model"));
  const values = candidates.flatMap(b => typeof scores[b.id] === "number" ? [normalized(b, scores[b.id] as number)] : []);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function portfolioScore(modelId: string, axis: BenchmarkAxis) {
  return axisScore(modelId, axis, "system");
}

function coverageFor(modelId: string, mode: BenchmarkMode) {
  const scores = scoresFor(modelId);
  const core = BENCHMARKS.filter(b => b.tier === "core" && (mode === "system" || b.mode === "model"));
  const present = core.filter(b => typeof scores[b.id] === "number").length;
  const pct = core.length ? Math.round(present / core.length * 100) : 0;
  const status = present === 0 ? "uncollected" : pct < 50 ? "partial" : "broad";
  return { present, total: core.length, pct, status } as const;
}

function coverageText(modelId: string, mode: BenchmarkMode, lang: Lang) {
  const coverage = coverageFor(modelId, mode);
  if (coverage.status === "uncollected") return UI[lang].notIngested;
  return `${coverage.pct}%`;
}

function rankScore(model: ModelRecord, lens: RankLens) {
  if (lens === "agent") return portfolioScore(model.id, "agent") ?? -1;
  if (lens === "coding") return portfolioScore(model.id, "coding") ?? -1;
  if (lens === "preference") return model.textElo ?? -1;
  if (lens === "speed") return model.speed ?? -1;
  if (lens === "value") return model.intelligence / Math.max(0.01, model.costTask);
  return model.intelligence;
}

function rankValue(model: ModelRecord, lens: RankLens) {
  const value = rankScore(model, lens);
  if (value < 0) return "N/A";
  if (lens === "preference") return `${Math.round(value)}`;
  if (lens === "speed") return `${Math.round(value)} t/s`;
  if (lens === "value") return `${Math.round(value)}×`;
  return value.toFixed(1);
}

const center = 160;
const radius = 118;
const radarPoint = (i: number, value: number, scale = radius) => {
  const angle = Math.PI * 2 * i / AXES.length - Math.PI / 2;
  return [center + Math.cos(angle) * scale * value / 100, center + Math.sin(angle) * scale * value / 100];
};
const radarPolygon = (value: number) => AXES.map((_, i) => radarPoint(i, value).join(",")).join(" ");

function Radar({ models, activeId, mode, lang }:{ models: ModelRecord[]; activeId: string; mode: BenchmarkMode; lang: Lang }) {
  const ui = UI[lang];
  const activeValues = AXES.map(a => axisScore(activeId, a.id, mode));
  const hasActive = activeValues.filter(v => v !== null).length >= 3;
  return <svg className="radar" viewBox="0 0 420 340" role="img" aria-label={lang === "zh" ? "七维能力雷达图" : "Seven-axis capability radar"}>
    <g className="radar-grid">
      {[20,40,60,80,100].map(v => <polygon key={v} points={radarPolygon(v)} />)}
      {AXES.map((_,i) => { const [x,y] = radarPoint(i,100); return <line key={i} x1={center} y1={center} x2={x} y2={y}/>; })}
    </g>
    {models.map(model => {
      const values = AXES.map(a => axisScore(model.id, a.id, mode));
      if (values.some(v => v === null)) return values.map((v,i) => v === null ? null : (() => { const [x,y] = radarPoint(i,v); return <circle className="radar-dot-only" key={`${model.id}-${i}`} cx={x} cy={y} r={model.id === activeId ? 4 : 3} fill={model.color}><title>{AXES[i][lang]}: {v.toFixed(1)}</title></circle>; })());
      const points = values.map((v,i) => radarPoint(i,v as number).join(",")).join(" ");
      return <g key={model.id} className={model.id === activeId ? "radar-series active" : "radar-series"}>
        <polygon points={points} fill={model.color} stroke={model.color}/>
        {values.map((v,i) => { const [x,y] = radarPoint(i,v as number); return <circle key={i} cx={x} cy={y} r={model.id === activeId ? 4 : 3} fill={model.color}><title>{AXES[i][lang]}: {(v as number).toFixed(1)}</title></circle>; })}
      </g>;
    })}
    {AXES.map((axis,i) => { const [x,y] = radarPoint(i,113,136); return <text key={axis.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{axis[lang]}</text>; })}
    {!hasActive && <g className="radar-empty"><circle cx={center} cy={center} r="53"/><text x={center} y={center-5} textAnchor="middle">N/A</text><text x={center} y={center+14} textAnchor="middle">{ui.noRadar}</text></g>}
  </svg>;
}

function BenchmarkChart({ models, axis, mode, lang }:{ models: ModelRecord[]; axis: BenchmarkAxis; mode: BenchmarkMode; lang: Lang }) {
  const ui = UI[lang];
  const metrics = BENCHMARKS.filter(b => b.axis === axis && b.tier !== "legacy" && (mode === "system" || b.mode === "model"));
  const width = Math.max(780, metrics.length * 126 + 90);
  const x = (i: number) => 66 + i * ((width - 110) / Math.max(1, metrics.length - 1));
  const y = (value: number) => 24 + (100 - value) * 1.72;
  return <div className="benchmark-chart-shell">
    <div className="chart-scroll"><svg className="benchmark-chart" viewBox={`0 0 ${width} 240`} style={{width}} role="img" aria-label={lang === "zh" ? "Benchmark 原始分数折线图" : "Raw benchmark score line chart"}>
      {[0,25,50,75,100].map(v => <g className="line-grid" key={v}><line x1="52" x2={width-30} y1={y(v)} y2={y(v)}/><text x="43" y={y(v)} textAnchor="end" dominantBaseline="middle">{v}</text></g>)}
      {metrics.map((b,i) => <g key={b.id}><text className="axis-label" x={x(i)} y="218" textAnchor="middle">{b.name}</text><text className="axis-version" x={x(i)} y="231" textAnchor="middle">{b.version}</text></g>)}
      {models.map(model => {
        const points = metrics.map((b,i) => { const raw = scoresFor(model.id)[b.id]; const observation = observationsFor(model.id)[b.id]; return typeof raw === "number" ? {x:x(i), y:y(normalized(b, raw)), raw, b, observation} : null; });
        const segments = points.flatMap((p,i) => p && i > 0 && points[i-1] ? [[points[i-1]!,p]] : []);
        return <g className="bench-series" key={model.id}>
          {segments.map((s,i) => <line key={i} x1={s[0].x} y1={s[0].y} x2={s[1].x} y2={s[1].y} stroke={model.color}/>)}
          {points.map((p,i) => p && <circle key={i} cx={p.x} cy={p.y} r="4" fill={model.color}><title>{model.name} · {p.b.name}: {p.raw}{p.b.unit} · {p.observation?.sourceLabel ?? "public source"}</title></circle>)}
        </g>;
      })}
    </svg></div>
    <div className="score-table-wrap"><table className="score-table"><thead><tr><th>{lang === "zh" ? "模型" : "Model"}</th>{metrics.map(b => <th key={b.id}>{b.name}<small>{b.version}</small></th>)}</tr></thead><tbody>{models.map(model => <tr key={model.id}><th><i style={{background:model.color}}/>{model.name}</th>{metrics.map(b => { const v=scoresFor(model.id)[b.id]; const observation=observationsFor(model.id)[b.id]; return <td key={b.id} className={observation ? `sourced ${observation.sourceKind}` : "missing"} title={observation ? `${observation.sourceLabel} · ${observation.benchmarkVersion}${observation.harness ? ` · ${observation.harness}` : ""}` : ui.notIngested}>{typeof v === "number" ? <>{v}{b.unit}<small>{observation?.sourceKind}</small></> : ui.unavailable}</td>; })}</tr>)}</tbody></table></div>
  </div>;
}

export default function Home() {
  const [lang,setLang] = useState<Lang>("zh");
  const [activeSection,setActiveSection] = useState("ranking");
  const [catalogOpen,setCatalogOpen] = useState(false);
  const [models,setModels] = useState(MODELS);
  const [activeId,setActiveId] = useState("gpt-5.6-sol-max");
  const [compareIds,setCompareIds] = useState<string[]>(["claude-fable-5","kimi-k3-max"]);
  const [lens,setLens] = useState<RankLens>("intelligence");
  const [profileMode,setProfileMode] = useState<BenchmarkMode>("system");
  const [axis,setAxis] = useState<BenchmarkAxis>("coding");
  const [query,setQuery] = useState("");
  const [maker,setMaker] = useState("All labs");
  const [openOnly,setOpenOnly] = useState(false);
  const [showAll,setShowAll] = useState(false);
  const [live,setLive] = useState(false);
  const [updated,setUpdated] = useState("snapshot");
  const ui = UI[lang];
  const active = models.find(x => x.id === activeId) ?? models[0];
  const compare = [active, ...compareIds.filter(id => id !== active.id).map(id => models.find(m => m.id === id)).filter(Boolean) as ModelRecord[]].slice(0,3);
  const makers = ["All labs", ...Array.from(new Set(models.map(x => x.maker)))];
  const coverage = coverageFor(active.id, profileMode);

  async function refresh() {
    setUpdated("refreshing");
    try {
      const res = await fetch("/api/live-models",{cache:"no-store"});
      if (!res.ok) throw new Error();
      const data = await res.json() as { prices: Record<string,{input:number;output:number;contextK?:number}> };
      setModels(now => now.map(model => data.prices[model.id] ? {...model, price:{...model.price,input:data.prices[model.id].input,output:data.prices[model.id].output},contextK:data.prices[model.id].contextK ?? model.contextK} : model));
      setLive(true); setUpdated("just now");
    } catch { setLive(false); setUpdated("snapshot"); }
  }

  useEffect(() => { const initial=setTimeout(refresh,0); const timer=setInterval(refresh,300000); return () => { clearTimeout(initial); clearInterval(timer); }; }, []);
  useEffect(() => { const saved=localStorage.getItem("observatory-language"); const frame=requestAnimationFrame(() => { if(saved === "zh" || saved === "en") setLang(saved); }); return () => cancelAnimationFrame(frame); }, []);
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; }, [lang]);
  useEffect(() => {
    const sectionIds = ["ranking","model-detail","benchmarks","pricing"];
    let frame = 0;
    const updateActiveSection = () => {
      const marker = Math.min(window.innerHeight * 0.34, 240);
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= marker) current = id;
      }
      setActiveSection(current);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActiveSection);
    };
    updateActiveSection();
    window.addEventListener("scroll",scheduleUpdate,{passive:true});
    window.addEventListener("resize",scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll",scheduleUpdate);
      window.removeEventListener("resize",scheduleUpdate);
    };
  }, []);

  const ranked = useMemo(() => models
    .filter(model => (maker === "All labs" || model.maker === maker) && (!openOnly || model.open) && `${model.name} ${model.maker}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => rankScore(b,lens)-rankScore(a,lens)), [models,maker,openOnly,query,lens]);
  const visible = showAll ? ranked : ranked.slice(0,10);

  const changeLang = (next: Lang) => { setLang(next); localStorage.setItem("observatory-language",next); };
  const selectModel = (id:string) => { setActiveId(id); if(window.innerWidth < 800) setTimeout(() => document.getElementById("model-detail")?.scrollIntoView({behavior:"smooth",block:"start"}),30); };
  const toggleCompare = (id:string) => setCompareIds(now => now.includes(id) ? now.filter(x => x !== id) : now.length < 2 ? [...now,id] : [now[1],id]);
  const lensName = LENSES.find(x => x.id === lens)?.[lang] ?? "";
  const leader = [...models].sort((a,b) => b.intelligence-a.intelligence)[0];
  const fastest = [...models].filter(m => m.speed !== null).sort((a,b) => (b.speed??0)-(a.speed??0))[0];
  const bestValue = [...models].sort((a,b) => rankScore(b,"value")-rankScore(a,"value"))[0];

  return <main className="shell">
    <aside className="rail"><div className="logo">Ø</div><nav><a className={activeSection==="ranking"?"active":""} href="#ranking" aria-label="Ranking" aria-current={activeSection==="ranking"?"page":undefined} onClick={()=>setActiveSection("ranking")}>⌁</a><a className={activeSection==="model-detail"?"active":""} href="#model-detail" aria-label="Capability" aria-current={activeSection==="model-detail"?"page":undefined} onClick={()=>setActiveSection("model-detail")}>◇</a><a className={activeSection==="benchmarks"?"active":""} href="#benchmarks" aria-label="Benchmarks" aria-current={activeSection==="benchmarks"?"page":undefined} onClick={()=>setActiveSection("benchmarks")}>△</a><a className={activeSection==="pricing"?"active":""} href="#pricing" aria-label="Pricing" aria-current={activeSection==="pricing"?"page":undefined} onClick={()=>setActiveSection("pricing")}>$</a></nav><a className="rail-source" href="#sources" aria-label="Sources">≡</a></aside>
    <div className="workspace">
      <header><div><p>{ui.eyebrow}</p><h1>{ui.brand}</h1></div><div className="header-actions"><label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ui.search}/></label><div className="lang-switch" aria-label="Language"><button className={lang==="zh"?"active":""} onClick={()=>changeLang("zh")}>中</button><button className={lang==="en"?"active":""} onClick={()=>changeLang("en")}>EN</button></div><button className={live?"live":"live offline"} onClick={refresh}><i/>{live?ui.live:ui.snapshot}<em>{updated}</em></button></div></header>

      <section className="brief">
        <div><span>{ui.tracked}</span><strong>{models.length}</strong><small>frontier models</small></div>
        <div><span>{ui.portfolio}</span><strong>{BENCHMARKS.length}</strong><small>7 capability families</small></div>
        <div><span>AA Intelligence</span><strong>{leader.name}</strong><small>{leader.intelligence} · {leader.maker}</small></div>
        <div><span>{lang === "zh" ? "输出速度最快" : "Fastest output"}</span><strong>{fastest.name}</strong><small>{fastest.speed} output tok/s</small></div>
        <div><span>{lang === "zh" ? "最佳性价比" : "Best value"}</span><strong>{bestValue.name}</strong><small>${bestValue.costTask.toFixed(2)} / AA task</small></div>
      </section>

      <section className="panel ranking-panel" id="ranking">
        <div className="section-head"><div className="section-title"><span>01</span><div><h2>{ui.ranking}</h2><p>{ui.rankingDesc}</p></div></div><div className="source-stamp"><i/>{ui.updated}</div></div>
        <div className="rank-toolbar"><div className="metric-tabs">{LENSES.map(item => <button key={item.id} className={lens===item.id?"active":""} onClick={()=>setLens(item.id)}><span>{item[lang]}</span><b>{lang === "zh" ? item.shortZh : item.shortEn}</b></button>)}</div><div className="filters"><select value={maker} onChange={e=>setMaker(e.target.value)} aria-label="Lab filter">{makers.map(x => <option key={x} value={x}>{x === "All labs" ? ui.allLabs : x}</option>)}</select><label><input type="checkbox" checked={openOnly} onChange={e=>setOpenOnly(e.target.checked)}/>{ui.open}</label></div></div>
        <div className="rank-head"><span>#</span><span>{lang === "zh" ? "模型" : "Model"}</span><span>{lensName}</span><span>AA</span><span>Arena</span><span>{lang === "zh" ? "编程组合" : "Coding"}</span><span>Agent</span><span>{lang === "zh" ? "速度" : "Speed"}</span><span>{ui.compare}</span></div>
        <div className="rank-list">{visible.map((model,index) => {
          const coding=portfolioScore(model.id,"coding"), agent=portfolioScore(model.id,"agent");
          return <article className={activeId===model.id?"rank-row active":"rank-row"} key={model.id}>
            <button className="rank-main" onClick={()=>selectModel(model.id)}>
              <span className="position">{String(index+1).padStart(2,"0")}</span><span className="model-id"><i style={{background:model.color}}/><span><b>{model.name}</b><small>{model.maker}{model.open?" · OPEN":""}</small></span></span>
              <strong className="lens-value">{rankValue(model,lens)}</strong><span>{model.intelligence}</span><span>{model.textElo ?? "N/A"}</span><span>{coding === null ? "N/A" : coding.toFixed(1)}</span><span>{agent === null ? "N/A" : agent.toFixed(1)}</span><span>{model.speed === null ? "N/A" : `${model.speed}`}</span>
            </button>
            <div className="mobile-metrics"><span>AA {model.intelligence}</span><span>Arena {model.textElo ?? "N/A"}</span><span>{lensName} {rankValue(model,lens)}</span></div>
            <label className="compare-check"><input type="checkbox" checked={compareIds.includes(model.id)} disabled={model.id===activeId} onChange={()=>toggleCompare(model.id)}/><span>{ui.compare}</span></label>
          </article>;
        })}</div>
        {ranked.length > 10 && <button className="show-all" onClick={()=>setShowAll(x=>!x)}>{showAll?ui.hide:ui.show}<span>{showAll?"↑":"↓"}</span></button>}
        <div className="rank-foot"><span>{ui.current}</span><strong>{lensName}</strong><p>{lens === "preference" ? (lang === "zh" ? "Arena 是人工偏好 Elo，不等同于任务正确率。" : "Arena is human-preference Elo, not task accuracy.") : (lang === "zh" ? "N/A 保持缺失，不参与当前排序。" : "N/A remains missing and does not enter this ranking.")}</p></div>
      </section>

      <section className="detail-grid" id="model-detail">
        <article className="panel radar-panel">
          <div className="section-head"><div className="section-title"><span>02</span><div><h2>{ui.capability}</h2><p>{ui.capabilityDesc}</p></div></div><div className="mode-switch"><button className={profileMode==="model"?"active":""} onClick={()=>setProfileMode("model")}><b>{ui.controlled}</b><span>{ui.controlledNote}</span></button><button className={profileMode==="system"?"active":""} onClick={()=>setProfileMode("system")}><b>{ui.best}</b><span>{ui.bestNote}</span></button></div></div>
          <div className="radar-layout"><Radar models={compare} activeId={activeId} mode={profileMode} lang={lang}/><div className="radar-side"><div className={`coverage-card ${coverage.status}`}><span>{ui.coverage}</span><strong>{coverageText(active.id,profileMode,lang)}</strong><div><i style={{width:`${coverage.pct}%`}}/></div><small>{coverage.status === "uncollected" ? ui.notIngested : `${coverage.present} / ${coverage.total} ${ui.coreMetrics} · ${coverage.status === "partial" ? ui.partialCoverage : ui.broadCoverage}`}</small></div><div className="legend">{compare.map(model => <button key={model.id} className={model.id===activeId?"active":""} onClick={()=>setActiveId(model.id)}><i style={{background:model.color}}/><span><b>{model.name}</b><small>{model.maker}</small></span><em>{coverageText(model.id,profileMode,lang)}</em></button>)}</div></div></div>
        </article>
        <aside className="panel dossier"><div className="dossier-top"><span>{lang === "zh" ? "当前模型" : "Selected model"}</span><h2>{active.name}</h2><p>{active.maker} · {active.open ? "OPEN WEIGHTS" : "PROPRIETARY"}</p></div><div className="kpis"><div><span>AA INTELLIGENCE</span><strong>{active.intelligence}</strong><small>independent composite</small></div><div><span>ARENA TEXT</span><strong>{active.textElo ?? "N/A"}</strong><small>human preference Elo</small></div><div><span>CODING PORTFOLIO</span><strong>{portfolioScore(active.id,"coding")?.toFixed(1) ?? "N/A"}</strong><small>best-system average</small></div><div><span>AGENT PORTFOLIO</span><strong>{portfolioScore(active.id,"agent")?.toFixed(1) ?? "N/A"}</strong><small>best-system average</small></div></div><div className="tags">{active.tags.map(tag=><span key={tag}>{tag}</span>)}</div><div className="price-strip"><div><span>{ui.input}</span><b>${formatUsd(active.price.input)}</b></div><div><span>{ui.output}</span><b>${formatUsd(active.price.output)}</b></div><div><span>CONTEXT</span><b>{active.contextK >= 1000 ? `${(active.contextK/1000).toFixed(1)}M` : `${active.contextK}K`}</b></div></div></aside>
      </section>

      <section className="panel benchmark-panel" id="benchmarks">
        <div className="section-head"><div className="section-title"><span>03</span><div><h2>{ui.benchmark}</h2><p>{ui.benchmarkDesc}</p></div></div><div className="compare-pills">{compare.map(model=>{const count=Object.keys(observationsFor(model.id)).length;return <button key={model.id} onClick={()=>setActiveId(model.id)}><i style={{background:model.color}}/>{model.name}<span>{count ? `${count} ${ui.observations}` : ui.notIngested}</span></button>;})}</div></div>
        <div className="benchmark-toolbar"><div className="axis-tabs">{AXES.map(item => <button key={item.id} className={axis===item.id?"active":""} onClick={()=>setAxis(item.id)}><span>{item[lang]}</span><b>{item.weight}%</b></button>)}</div><div className="mode-compact"><button className={profileMode==="model"?"active":""} onClick={()=>setProfileMode("model")}>{ui.controlled}</button><button className={profileMode==="system"?"active":""} onClick={()=>setProfileMode("system")}>{ui.best}</button></div></div>
        <div className="benchmark-body"><BenchmarkChart models={compare} axis={axis} mode={profileMode} lang={lang}/></div>
      </section>

      <section className="panel pricing-panel" id="pricing"><div className="section-head"><div className="section-title"><span>04</span><div><h2>{ui.pricing}</h2><p>{ui.pricingDesc}</p></div></div><button className={live?"feed-status":"feed-status offline"} onClick={refresh}><i/>{live?ui.live:ui.snapshot}</button></div><div className="price-cards">{compare.map(model => { const blended=model.price.input*.7+model.price.output*.2+model.price.cache*.1; return <article key={model.id} style={{"--accent":model.color} as React.CSSProperties}><div className="card-name"><i/><span><b>{model.name}</b><small>{model.maker}</small></span></div><div className="price-pair"><div><span>{ui.input}</span><strong>${formatUsd(model.price.input)}</strong></div><div><span>{ui.output}</span><strong>${formatUsd(model.price.output)}</strong></div></div><div className="blended"><span>{ui.blended}</span><b>${formatUsd(blended)}</b><i><em style={{width:`${Math.min(100,blended/8*100)}%`}}/></i></div></article>; })}</div></section>

      <section className="panel catalog-panel">
        <div className="section-head"><div className="section-title"><span>05</span><div><h2>{ui.catalog}</h2><p>{ui.catalogDesc}</p></div></div><div className="catalog-actions"><div className="catalog-count">{BENCHMARKS.filter(b=>b.tier==="core").length} CORE · {BENCHMARKS.filter(b=>b.tier==="observe").length} OBSERVE</div><button className="catalog-toggle" type="button" aria-expanded={catalogOpen} onClick={()=>setCatalogOpen(open=>!open)}>{catalogOpen ? (lang==="zh"?"收起目录":"Collapse catalog") : (lang==="zh"?`展开 ${BENCHMARKS.length} 项`:`Show ${BENCHMARKS.length} items`)}<span>{catalogOpen?"↑":"↓"}</span></button></div></div>
        {catalogOpen && <div className="catalog-grid">{BENCHMARKS.map(b => <a className={`catalog-card ${b.tier}`} href={b.url} target="_blank" rel="noreferrer" key={b.id}><div><span className={`tier ${b.tier}`}>{ui[b.tier]}</span><span className={`method ${b.method}`}>{b.method === "execution" ? ui.exec : b.method === "exam" ? ui.exam : b.method === "rubric" ? ui.rubric : ui.preference}</span></div><h3>{b.name}</h3><p>{b[lang]}</p><footer><span>{AXES.find(a=>a.id===b.axis)?.[lang]}</span><b>{b.mode === "model" ? ui.modelMode : ui.systemMode}</b><em>{b.version} ↗</em></footer></a>)}</div>}
      </section>

      <section className="sources" id="sources"><div><span>06</span><h2>{ui.sources}</h2><div className="source-summary"><b>{Object.values(SOURCE_META).filter(source=>source.status==="active").length} {lang==="zh"?"已接入":"CONNECTED"}</b><span>{Object.values(SOURCE_META).filter(source=>source.status==="queued").length} {lang==="zh"?"接入队列":"QUEUED"}</span></div></div><div className="source-grid">{Object.values(SOURCE_META).map(source=><a className={source.status} href={source.url} target="_blank" rel="noreferrer" key={source.label}><div><span>{source.date}</span><i>{source.status==="active"?(lang==="zh"?"已接入":"CONNECTED"):(lang==="zh"?"接入队列":"QUEUED")}</i></div><b>{source.label}</b><small>{source.role}</small><em>↗</em></a>)}</div><p>{ui.sourceNote}</p></section>
      <footer className="site-footer"><div><i/>VERSIONED SNAPSHOT · 2026-07-31</div><span>AI Model Observatory</span><a href="#ranking">{ui.back}</a></footer>
    </div>
  </main>;
}
