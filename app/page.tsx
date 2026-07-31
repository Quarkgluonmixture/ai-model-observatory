"use client";

import { useEffect, useMemo, useState } from "react";
import { MODELS, SOURCE_META, type ModelRecord } from "./model-data";

type SortKey = "intelligence" | "textElo" | "codeElo" | "speed" | "value";
type Lang = "zh" | "en";
const UI = {
  zh:{search:"搜索 20 个模型",ranking:"前沿模型排行榜",rankingDesc:"选择评价维度，再点选任一模型查看能力画像。",allLabs:"全部实验室",open:"仅开放权重",compare:"对比",show:"显示全部 20 个模型",hide:"收起至前 10 名",current:"当前排序",capability:"能力画像",capabilityDesc:"统一归一化便于比较；下方保留原始 Benchmark 分数。",selected:"当前模型",benchmark:"Benchmark 跑分",benchmarkDesc:"展示原始值，不混成营销式综合分；最多比较三个模型。",pricing:"Token 价格",pricingDesc:"每百万 Token 的供应商价格；实时匹配，失败时回退快照。",sources:"数据来源与阅读",back:"返回排行榜 ↑",operational:"数据层运行正常",tracked:"收录模型",models:"个前沿模型",leader:"综合智能领先",fastest:"输出速度最快",value:"最佳性价比",input:"输入",output:"输出",snapshot:"价格快照",live:"实时数据",brand:"AI 模型观测站",eyebrow:"前沿智能",radarNote:"人类偏好与编程维度优先采用 Arena Elo。缺失值仅在归一化雷达图中使用保守的智能指数估计。",higher:"越高越好",context:"上下文",speed:"输出速度",tokensSecond:"Token / 秒",firstChunk:"首个响应块",costTask:"AA 单任务成本",blended:"7:2:1 混合价",sourceNote:"Arena 分数是人类偏好 Elo，并非客观任务准确率。Artificial Analysis Intelligence 是独立的综合指标。缺失值保留为 N/A；仅雷达图使用的估计值已明确披露。"},
  en:{search:"Search 20 models",ranking:"Frontier model ranking",rankingDesc:"Choose a lens, then select any model for a grounded capability view.",allLabs:"All labs",open:"Open weights",compare:"Compare",show:"Show all 20 models",hide:"Show top 10",current:"Current lens",capability:"Capability profile",capabilityDesc:"Comparable normalization; original benchmark values remain below.",selected:"Selected model",benchmark:"Benchmark scorecard",benchmarkDesc:"Raw values, not a blended marketing score. Compare up to three models.",pricing:"Token economics",pricingDesc:"Provider price per million tokens; live match with snapshot fallback.",sources:"Sources & reading",back:"Back to ranking ↑",operational:"Data layer operational",tracked:"Tracked",models:"frontier models",leader:"Leader",fastest:"Fastest",value:"Best value",input:"Input",output:"Output",snapshot:"Snapshot",live:"Live feed",brand:"AI Model Observatory",eyebrow:"Frontier intelligence",radarNote:"Human preference and coding axes use Arena Elo where available. N/A values use a conservative intelligence-derived estimate only in this normalized radar.",higher:"higher is better",context:"Context",speed:"Output speed",tokensSecond:"tokens / second",firstChunk:"first chunk",costTask:"Cost / AA task",blended:"7:2:1 blended",sourceNote:"Arena scores are human-preference Elo, not objective task accuracy. Artificial Analysis Intelligence is a separate independent composite. Missing values stay N/A; radar-only estimates are explicitly disclosed."}
};
const metricTabs: { key: SortKey; label: string; short: string }[] = [
  { key:"intelligence", label:"AA Intelligence", short:"Intelligence" },
  { key:"textElo", label:"Arena Text", short:"Arena" },
  { key:"codeElo", label:"Code Arena", short:"Coding" },
  { key:"speed", label:"Output speed", short:"Speed" },
  { key:"value", label:"Value / task", short:"Value" },
];

const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const scoreFor=(m:ModelRecord,key:SortKey)=>key==="value"?m.intelligence/Math.max(.01,m.costTask):(m[key]??-1);
const radarAxes={zh:["智能","人类偏好","编程","速度","性价比","上下文"],en:["Intelligence","Human pref.","Coding","Speed","Value","Context"]};
const radarValues=(m:ModelRecord)=>[
  clamp(m.intelligence/61*100),
  m.textElo?clamp((m.textElo-1320)/1.88):clamp(m.intelligence/61*90),
  m.codeElo?clamp((m.codeElo-1400)/3.12):clamp(m.intelligence/61*88),
  m.speed?clamp(Math.sqrt(m.speed/217)*100):45,
  clamp(42+Math.log10(1+m.intelligence/Math.max(.01,m.costTask))*19),
  clamp(Math.sqrt(m.contextK/1050)*100),
];
const point=(i:number,v:number,r=122)=>{const a=Math.PI*2*i/6-Math.PI/2;return[154+Math.cos(a)*r*v/100,146+Math.sin(a)*r*v/100]};
const polygon=(v:number[])=>v.map((x,i)=>point(i,x).join(",")).join(" ");
const fmt=(value:number|null, digits=0)=>value===null?"N/A":value.toFixed(digits);

function Radar({items,active,lang}:{items:ModelRecord[];active:string;lang:Lang}){
  const axes=radarAxes[lang];
  return <svg className="radar" viewBox="0 0 400 305" role="img" aria-label="Normalized six-axis model comparison">
    <g className="radar-grid">{[20,40,60,80,100].map(v=><polygon key={v} points={polygon(Array(6).fill(v))}/>)}{axes.map((_,i)=>{const[x,y]=point(i,100);return <line key={i} x1="154" y1="146" x2={x} y2={y}/>})}</g>
    {items.map(m=><g key={m.id} className={m.id===active?"radar-series active":"radar-series"}><polygon points={polygon(radarValues(m))} fill={m.color} stroke={m.color}/>{radarValues(m).map((v,i)=>{const[x,y]=point(i,v);return <circle key={i} cx={x} cy={y} r={m.id===active?4:3} fill={m.color}><title>{axes[i]}: {Math.round(v)}</title></circle>})}</g>)}
    {axes.map((axis,i)=>{const[x,y]=point(i,116);return <text key={axis} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{axis}</text>})}
  </svg>
}

function MetricBar({label,unit,items,value,max,invert=false}:{label:string;unit:string;items:ModelRecord[];value:(m:ModelRecord)=>number|null;max:number;invert?:boolean}){
  return <div className="metric-row"><div className="metric-name"><b>{label}</b><span>{unit}</span></div><div className="metric-bars">{items.map(m=>{const raw=value(m);const width=raw===null?0:invert?clamp((1-raw/max)*100):clamp(raw/max*100);return <div className="metric-line" key={m.id}><i style={{background:m.color,width:`${width}%`}}/><span style={{color:m.color}}>{raw===null?"N/A":unit.startsWith("$")?`$${raw.toFixed(2)}`:(unit==="seconds"||unit==="秒")?raw.toFixed(2):raw.toFixed(0)}</span></div>})}</div></div>
}

export default function Home(){
  const [lang,setLang]=useState<Lang>("zh");
  const [models,setModels]=useState(MODELS);
  const [activeId,setActiveId]=useState(MODELS[0].id);
  const [compareIds,setCompareIds]=useState<string[]>(["claude-fable-5","gpt-5.6-sol-xhigh"]);
  const [sort,setSort]=useState<SortKey>("intelligence");
  const [query,setQuery]=useState("");
  const [maker,setMaker]=useState("All labs");
  const [openOnly,setOpenOnly]=useState(false);
  const [showAll,setShowAll]=useState(false);
  const [live,setLive]=useState(false);
  const [updated,setUpdated]=useState("snapshot");
  const active=models.find(m=>m.id===activeId)??models[0];
  const ui=UI[lang];
  const compare=[active,...compareIds.filter(id=>id!==active.id).map(id=>models.find(m=>m.id===id)).filter(Boolean) as ModelRecord[]].slice(0,3);
  const makers=["All labs",...Array.from(new Set(models.map(m=>m.maker)))];

  async function refresh(){setUpdated("refreshing");try{const res=await fetch("/api/live-models",{cache:"no-store"});if(!res.ok)throw new Error();const data=await res.json() as {prices:Record<string,{input:number;output:number;contextK?:number}>};setModels(now=>now.map(m=>data.prices[m.id]?{...m,price:{...m.price,input:data.prices[m.id].input,output:data.prices[m.id].output},contextK:data.prices[m.id].contextK??m.contextK}:m));setLive(true);setUpdated("just now")}catch{setLive(false);setUpdated("snapshot")}}
  useEffect(()=>{refresh();const t=setInterval(refresh,300000);return()=>clearInterval(t)},[]);
  useEffect(()=>{const saved=localStorage.getItem("observatory-language");if(saved==="zh"||saved==="en")setLang(saved)},[]);
  const changeLang=(next:Lang)=>{setLang(next);localStorage.setItem("observatory-language",next)};

  const ranked=useMemo(()=>models.filter(m=>(maker==="All labs"||m.maker===maker)&&(!openOnly||m.open)&&`${m.name} ${m.maker}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>scoreFor(b,sort)-scoreFor(a,sort)),[models,maker,openOnly,query,sort]);
  const visible=showAll?ranked:ranked.slice(0,10);
  const selectModel=(id:string)=>{setActiveId(id);if(window.innerWidth<800)setTimeout(()=>document.getElementById("model-detail")?.scrollIntoView({behavior:"smooth",block:"start"}),40)};
  const toggleCompare=(id:string)=>setCompareIds(now=>now.includes(id)?now.filter(x=>x!==id):now.length<2?[...now,id]:[now[1],id]);
  const rankValue=(m:ModelRecord)=>sort==="value"?`${(m.intelligence/m.costTask).toFixed(0)}×`:sort==="speed"?`${fmt(m.speed)} t/s`:sort==="textElo"||sort==="codeElo"?fmt(m[sort]):fmt(m.intelligence);

  return <main className="shell">
    <aside className="rail"><div className="logo">Ø</div><nav><a className="active" href="#ranking" aria-label="Ranking">⌁</a><a href="#model-detail" aria-label="Compare">◇</a><a href="#benchmarks" aria-label="Benchmarks">△</a><a href="#pricing" aria-label="Pricing">$</a></nav><a className="rail-source" href="#sources" aria-label="Sources">≡</a></aside>
    <div className="workspace">
      <header><div><p>{ui.eyebrow}</p><h1>{ui.brand}</h1></div><div className="header-actions"><label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ui.search}/></label><div className="lang-switch" aria-label="Language"><button className={lang==="zh"?"active":""} onClick={()=>changeLang("zh")}>中</button><button className={lang==="en"?"active":""} onClick={()=>changeLang("en")}>EN</button></div><button className={live?"live":"live offline"} onClick={refresh}><i/>{live?ui.live:ui.snapshot}<em>{updated}</em></button></div></header>
      <section className="brief"><div><span>{ui.tracked}</span><strong>20</strong><small>{ui.models}</small></div><div><span>{ui.leader}</span><strong>Claude Opus 5</strong><small>AA Intelligence · 61</small></div><div><span>{ui.fastest}</span><strong>Gemini 3.6 Flash</strong><small>217 output tok/s</small></div><div><span>{ui.value}</span><strong>DeepSeek V4 Flash</strong><small>$0.03 / AA task</small></div></section>

      <section className="panel ranking-panel" id="ranking">
        <div className="section-head"><div className="section-title"><span>01</span><div><h2>{ui.ranking}</h2><p>{ui.rankingDesc}</p></div></div><div className="source-stamp"><i/>{lang==="zh"?"更新于 2026 年 7 月 31 日":"Updated 31 Jul 2026"}</div></div>
        <div className="rank-toolbar"><div className="metric-tabs">{metricTabs.map(t=><button key={t.key} className={sort===t.key?"active":""} onClick={()=>setSort(t.key)}><span>{lang==="zh"?({intelligence:"AA 智能指数",textElo:"Arena 文本",codeElo:"Code Arena",speed:"输出速度",value:"单任务性价比"} as Record<SortKey,string>)[t.key]:t.label}</span><b>{lang==="zh"?({intelligence:"智能",textElo:"竞技场",codeElo:"编程",speed:"速度",value:"性价比"} as Record<SortKey,string>)[t.key]:t.short}</b></button>)}</div><div className="filters"><select value={maker} onChange={e=>setMaker(e.target.value)} aria-label="Filter by lab">{makers.map(x=><option key={x} value={x}>{x==="All labs"?ui.allLabs:x}</option>)}</select><label><input type="checkbox" checked={openOnly} onChange={e=>setOpenOnly(e.target.checked)}/> {ui.open}</label></div></div>
        <div className="rank-head"><span>#</span><span>{lang==="zh"?"模型":"MODEL"}</span><span>{lang==="zh"?"AA 指数":"AA INDEX"}</span><span>ARENA</span><span>{lang==="zh"?"编程":"CODE"}</span><span>{lang==="zh"?"速度":"SPEED"}</span><span>{lang==="zh"?"单任务成本":"COST / TASK"}</span><span>{lang==="zh"?"对比":"COMPARE"}</span></div>
        <div className="rank-list">{visible.map((m,i)=><div key={m.id} className={m.id===activeId?"rank-row active":"rank-row"}>
          <button className="rank-main" onClick={()=>selectModel(m.id)} aria-label={`View ${m.name}`}><span className="position">{String(i+1).padStart(2,"0")}</span><span className="model-id"><i style={{background:m.color}}/><span><b>{m.name}</b><small>{m.maker} · {m.contextK>=1000?`${m.contextK/1000}M`:`${m.contextK}K`}{m.open?" · OPEN":""}</small></span></span><strong className="aa">{m.intelligence}</strong><span>{fmt(m.textElo)}</span><span>{fmt(m.codeElo)}</span><span>{m.speed?`${m.speed}`:"N/A"}</span><span>${m.costTask.toFixed(2)}</span></button>
          <div className="mobile-metrics"><span>AA <b>{m.intelligence}</b></span><span>Arena <b>{fmt(m.textElo)}</b></span><span>Code <b>{fmt(m.codeElo)}</b></span><span>{rankValue(m)}</span></div>
          <label className="compare-check"><input type="checkbox" checked={compareIds.includes(m.id)} onChange={()=>toggleCompare(m.id)} disabled={!compareIds.includes(m.id)&&compareIds.length>=2}/><span>{ui.compare}</span></label>
        </div>)}</div>
        {ranked.length>10&&<button className="show-all" onClick={()=>setShowAll(!showAll)}>{showAll?ui.hide:ui.show}<span>{showAll?"↑":"↓"}</span></button>}
        <div className="rank-foot"><span>{ui.current}</span><strong>{metricTabs.find(t=>t.key===sort)?.label}</strong><p>{sort==="intelligence"?(lang==="zh"?"由十项独立评测组成的复合指标。":"Independent composite across ten evaluations."):sort==="textElo"?(lang==="zh"?"基于 750 万次 Arena 人类偏好投票。":"Human preference from 7.50M Arena votes."):sort==="codeElo"?(lang==="zh"?"基于完整 WebDev 任务的偏好 Elo。":"WebDev Arena preference across full-stack tasks."):sort==="speed"?(lang==="zh"?"中位输出吞吐，越高越好。":"Median output throughput; higher is better."):(lang==="zh"?"智能指数除以评测单任务成本。":"Intelligence points divided by evaluated cost per task.")}</p></div>
      </section>

      <section className="detail-grid" id="model-detail">
        <article className="panel radar-panel"><div className="section-head"><div className="section-title"><span>02</span><div><h2>{ui.capability}</h2><p>{ui.capabilityDesc}</p></div></div><div className="model-chip"><i style={{background:active.color}}/>{active.name}</div></div><div className="radar-layout"><Radar items={compare} active={active.id} lang={lang}/><div className="legend">{compare.map(m=><button key={m.id} onClick={()=>setActiveId(m.id)} className={m.id===active.id?"active":""}><i style={{background:m.color}}/><span><b>{m.name}</b><small>{m.maker}</small></span><em>{m.intelligence}</em></button>)}<p>{ui.radarNote}</p></div></div></article>
        <article className="panel dossier"><div className="dossier-top"><span>{ui.selected}</span><h2>{active.name}</h2><p>{active.tags.join(" · ")}</p></div><div className="kpis"><div><span>AA INTELLIGENCE</span><strong>{active.intelligence}</strong><small>{ui.higher}</small></div><div><span>{ui.context}</span><strong>{active.contextK>=1000?`${active.contextK/1000}M`:`${active.contextK}K`}</strong><small>tokens</small></div><div><span>{ui.speed}</span><strong>{fmt(active.speed)}</strong><small>{ui.tokensSecond}</small></div><div><span>TTFT</span><strong>{active.latency?`${active.latency.toFixed(2)}s`:"N/A"}</strong><small>{ui.firstChunk}</small></div></div><div className="tags">{active.tags.map(t=><span key={t}>{t}</span>)}</div><div className="price-strip"><div><span>{ui.input} / 1M</span><b>${active.price.input.toFixed(2)}</b></div><div><span>{ui.output} / 1M</span><b>${active.price.output.toFixed(2)}</b></div><div><span>{ui.costTask}</span><b>${active.costTask.toFixed(2)}</b></div></div></article>
      </section>

      <section className="panel benchmark-panel" id="benchmarks"><div className="section-head"><div className="section-title"><span>03</span><div><h2>{ui.benchmark}</h2><p>{ui.benchmarkDesc}</p></div></div><div className="compare-pills">{compare.map(m=><button key={m.id} onClick={()=>m.id!==active.id&&toggleCompare(m.id)}><i style={{background:m.color}}/>{m.name}<span>{m.id===active.id?ui.selected:"×"}</span></button>)}</div></div><div className="benchmark-body"><div className="metric-legend">{compare.map(m=><span key={m.id}><i style={{background:m.color}}/>{m.name}</span>)}</div><MetricBar label={lang==="zh"?"AA 智能指数":"AA Intelligence"} unit={lang==="zh"?"指数":"index"} items={compare} value={m=>m.intelligence} max={65}/><MetricBar label={lang==="zh"?"Arena 文本":"Arena Text"} unit="Elo" items={compare} value={m=>m.textElo} max={1550}/><MetricBar label="Code Arena · WebDev" unit="Elo" items={compare} value={m=>m.codeElo} max={1750}/><MetricBar label={lang==="zh"?"输出速度":"Output speed"} unit="tok/s" items={compare} value={m=>m.speed} max={230}/><MetricBar label={lang==="zh"?"首个响应块延迟":"Latency to first chunk"} unit={lang==="zh"?"秒":"seconds"} items={compare} value={m=>m.latency} max={170} invert/><MetricBar label={lang==="zh"?"评测单任务成本":"Evaluated cost / task"} unit={lang==="zh"?"$ / 任务":"$ / task"} items={compare} value={m=>m.costTask} max={3.5} invert/></div></section>

      <section className="panel pricing-panel" id="pricing"><div className="section-head"><div className="section-title"><span>04</span><div><h2>{ui.pricing}</h2><p>{ui.pricingDesc}</p></div></div><button className={live?"feed-status":"feed-status offline"} onClick={refresh}><i/>{live?ui.live:ui.snapshot}</button></div><div className="price-cards">{compare.map(m=><article key={m.id} style={{"--accent":m.color} as React.CSSProperties}><div className="card-name"><i/><span><b>{m.name}</b><small>{m.maker}</small></span></div><div className="price-pair"><div><span>{ui.input}</span><strong>${m.price.input.toFixed(2)}</strong></div><div><span>{ui.output}</span><strong>${m.price.output.toFixed(2)}</strong></div></div><div className="blended"><span>{ui.blended}</span><b>${(.7*m.price.cache+.2*m.price.input+.1*m.price.output).toFixed(2)}</b><i><em style={{width:`${Math.min(100,m.price.output/30*100)}%`}}/></i></div></article>)}</div></section>

      <section className="sources" id="sources"><div><span>05</span><h2>{ui.sources}</h2></div><div className="source-grid">{Object.values(SOURCE_META).map(s=><a key={s.label} href={s.url} target="_blank" rel="noreferrer"><span>{s.label}</span><b>{s.date}</b><small>{"votes" in s?s.votes:(lang==="zh"?"公开 Benchmark 快照":"Public benchmark snapshot")}</small><em>↗</em></a>)}</div><p>{ui.sourceNote}</p></section>
      <footer><div><i/>{ui.operational}</div><span>London · 31 Jul 2026 · UTC+1</span><a href="#ranking">{ui.back}</a></footer>
    </div>
  </main>
}
