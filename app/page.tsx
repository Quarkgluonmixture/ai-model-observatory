"use client";

import { useEffect, useMemo, useState } from "react";
import { MODELS, SOURCE_META, type ModelRecord } from "./model-data";

type SortKey = "intelligence" | "textElo" | "codeElo" | "speed" | "value";
const metricTabs: { key: SortKey; label: string; short: string }[] = [
  { key:"intelligence", label:"AA Intelligence", short:"Intelligence" },
  { key:"textElo", label:"Arena Text", short:"Arena" },
  { key:"codeElo", label:"Code Arena", short:"Coding" },
  { key:"speed", label:"Output speed", short:"Speed" },
  { key:"value", label:"Value / task", short:"Value" },
];

const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const scoreFor=(m:ModelRecord,key:SortKey)=>key==="value"?m.intelligence/Math.max(.01,m.costTask):(m[key]??-1);
const radarAxes=["Intelligence","Human pref.","Coding","Speed","Value","Context"];
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

function Radar({items,active}:{items:ModelRecord[];active:string}){
  return <svg className="radar" viewBox="0 0 400 305" role="img" aria-label="Normalized six-axis model comparison">
    <g className="radar-grid">{[20,40,60,80,100].map(v=><polygon key={v} points={polygon(Array(6).fill(v))}/>)}{radarAxes.map((_,i)=>{const[x,y]=point(i,100);return <line key={i} x1="154" y1="146" x2={x} y2={y}/>})}</g>
    {items.map(m=><g key={m.id} className={m.id===active?"radar-series active":"radar-series"}><polygon points={polygon(radarValues(m))} fill={m.color} stroke={m.color}/>{radarValues(m).map((v,i)=>{const[x,y]=point(i,v);return <circle key={i} cx={x} cy={y} r={m.id===active?4:3} fill={m.color}><title>{radarAxes[i]}: {Math.round(v)}</title></circle>})}</g>)}
    {radarAxes.map((axis,i)=>{const[x,y]=point(i,116);return <text key={axis} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{axis}</text>})}
  </svg>
}

function MetricBar({label,unit,items,value,max,invert=false}:{label:string;unit:string;items:ModelRecord[];value:(m:ModelRecord)=>number|null;max:number;invert?:boolean}){
  return <div className="metric-row"><div className="metric-name"><b>{label}</b><span>{unit}</span></div><div className="metric-bars">{items.map(m=>{const raw=value(m);const width=raw===null?0:invert?clamp((1-raw/max)*100):clamp(raw/max*100);return <div className="metric-line" key={m.id}><i style={{background:m.color,width:`${width}%`}}/><span style={{color:m.color}}>{raw===null?"N/A":unit.startsWith("$")?`$${raw.toFixed(2)}`:raw.toFixed(label.includes("Latency")?2:0)}</span></div>})}</div></div>
}

export default function Home(){
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
  const compare=[active,...compareIds.filter(id=>id!==active.id).map(id=>models.find(m=>m.id===id)).filter(Boolean) as ModelRecord[]].slice(0,3);
  const makers=["All labs",...Array.from(new Set(models.map(m=>m.maker)))];

  async function refresh(){setUpdated("refreshing");try{const res=await fetch("/api/live-models",{cache:"no-store"});if(!res.ok)throw new Error();const data=await res.json() as {prices:Record<string,{input:number;output:number;contextK?:number}>};setModels(now=>now.map(m=>data.prices[m.id]?{...m,price:{...m.price,input:data.prices[m.id].input,output:data.prices[m.id].output},contextK:data.prices[m.id].contextK??m.contextK}:m));setLive(true);setUpdated("just now")}catch{setLive(false);setUpdated("snapshot")}}
  useEffect(()=>{refresh();const t=setInterval(refresh,300000);return()=>clearInterval(t)},[]);

  const ranked=useMemo(()=>models.filter(m=>(maker==="All labs"||m.maker===maker)&&(!openOnly||m.open)&&`${m.name} ${m.maker}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>scoreFor(b,sort)-scoreFor(a,sort)),[models,maker,openOnly,query,sort]);
  const visible=showAll?ranked:ranked.slice(0,10);
  const selectModel=(id:string)=>{setActiveId(id);if(window.innerWidth<800)setTimeout(()=>document.getElementById("model-detail")?.scrollIntoView({behavior:"smooth",block:"start"}),40)};
  const toggleCompare=(id:string)=>setCompareIds(now=>now.includes(id)?now.filter(x=>x!==id):now.length<2?[...now,id]:[now[1],id]);
  const rankValue=(m:ModelRecord)=>sort==="value"?`${(m.intelligence/m.costTask).toFixed(0)}×`:sort==="speed"?`${fmt(m.speed)} t/s`:sort==="textElo"||sort==="codeElo"?fmt(m[sort]):fmt(m.intelligence);

  return <main className="shell">
    <aside className="rail"><div className="logo">Ø</div><nav><a className="active" href="#ranking" aria-label="Ranking">⌁</a><a href="#model-detail" aria-label="Compare">◇</a><a href="#benchmarks" aria-label="Benchmarks">△</a><a href="#pricing" aria-label="Pricing">$</a></nav><a className="rail-source" href="#sources" aria-label="Sources">≡</a></aside>
    <div className="workspace">
      <header><div><p>FRONTIER INTELLIGENCE</p><h1>AI Model Observatory</h1></div><div className="header-actions"><label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search 20 models"/></label><button className={live?"live":"live offline"} onClick={refresh}><i/>{live?"LIVE":"SNAPSHOT"}<em>{updated}</em></button></div></header>
      <section className="brief"><div><span>TRACKED</span><strong>20</strong><small>frontier models</small></div><div><span>LEADER</span><strong>Claude Opus 5</strong><small>AA Intelligence · 61</small></div><div><span>FASTEST</span><strong>Gemini 3.6 Flash</strong><small>217 output tok/s</small></div><div><span>BEST VALUE</span><strong>DeepSeek V4 Flash</strong><small>$0.03 / AA task</small></div></section>

      <section className="panel ranking-panel" id="ranking">
        <div className="section-head"><div className="section-title"><span>01</span><div><h2>Frontier model ranking</h2><p>Choose a lens, then select any model for a grounded capability view.</p></div></div><div className="source-stamp"><i/>Updated 31 Jul 2026</div></div>
        <div className="rank-toolbar"><div className="metric-tabs">{metricTabs.map(t=><button key={t.key} className={sort===t.key?"active":""} onClick={()=>setSort(t.key)}><span>{t.label}</span><b>{t.short}</b></button>)}</div><div className="filters"><select value={maker} onChange={e=>setMaker(e.target.value)} aria-label="Filter by lab">{makers.map(x=><option key={x}>{x}</option>)}</select><label><input type="checkbox" checked={openOnly} onChange={e=>setOpenOnly(e.target.checked)}/> Open weights</label></div></div>
        <div className="rank-head"><span>#</span><span>MODEL</span><span>AA INDEX</span><span>ARENA</span><span>CODE</span><span>SPEED</span><span>COST / TASK</span><span>COMPARE</span></div>
        <div className="rank-list">{visible.map((m,i)=><div key={m.id} className={m.id===activeId?"rank-row active":"rank-row"}>
          <button className="rank-main" onClick={()=>selectModel(m.id)} aria-label={`View ${m.name}`}><span className="position">{String(i+1).padStart(2,"0")}</span><span className="model-id"><i style={{background:m.color}}/><span><b>{m.name}</b><small>{m.maker} · {m.contextK>=1000?`${m.contextK/1000}M`:`${m.contextK}K`}{m.open?" · OPEN":""}</small></span></span><strong className="aa">{m.intelligence}</strong><span>{fmt(m.textElo)}</span><span>{fmt(m.codeElo)}</span><span>{m.speed?`${m.speed}`:"N/A"}</span><span>${m.costTask.toFixed(2)}</span></button>
          <div className="mobile-metrics"><span>AA <b>{m.intelligence}</b></span><span>Arena <b>{fmt(m.textElo)}</b></span><span>Code <b>{fmt(m.codeElo)}</b></span><span>{rankValue(m)}</span></div>
          <label className="compare-check"><input type="checkbox" checked={compareIds.includes(m.id)} onChange={()=>toggleCompare(m.id)} disabled={!compareIds.includes(m.id)&&compareIds.length>=2}/><span>Compare</span></label>
        </div>)}</div>
        {ranked.length>10&&<button className="show-all" onClick={()=>setShowAll(!showAll)}>{showAll?"Show top 10":"Show all 20 models"}<span>{showAll?"↑":"↓"}</span></button>}
        <div className="rank-foot"><span>Current lens</span><strong>{metricTabs.find(t=>t.key===sort)?.label}</strong><p>{sort==="intelligence"?"Independent composite across ten evaluations.":sort==="textElo"?"Human preference from 7.50M Arena votes.":sort==="codeElo"?"WebDev Arena preference across full-stack tasks.":sort==="speed"?"Median output throughput; higher is better.":"Intelligence points divided by evaluated cost per task."}</p></div>
      </section>

      <section className="detail-grid" id="model-detail">
        <article className="panel radar-panel"><div className="section-head"><div className="section-title"><span>02</span><div><h2>Capability profile</h2><p>Comparable normalization; original benchmark values remain below.</p></div></div><div className="model-chip"><i style={{background:active.color}}/>{active.name}</div></div><div className="radar-layout"><Radar items={compare} active={active.id}/><div className="legend">{compare.map(m=><button key={m.id} onClick={()=>setActiveId(m.id)} className={m.id===active.id?"active":""}><i style={{background:m.color}}/><span><b>{m.name}</b><small>{m.maker}</small></span><em>{m.intelligence}</em></button>)}<p>Human preference and coding axes use Arena Elo where available. N/A values use a conservative intelligence-derived estimate only in this normalized radar.</p></div></div></article>
        <article className="panel dossier"><div className="dossier-top"><span>SELECTED MODEL</span><h2>{active.name}</h2><p>{active.tags.join(" · ")}</p></div><div className="kpis"><div><span>AA INTELLIGENCE</span><strong>{active.intelligence}</strong><small>higher is better</small></div><div><span>CONTEXT</span><strong>{active.contextK>=1000?`${active.contextK/1000}M`:`${active.contextK}K`}</strong><small>tokens</small></div><div><span>OUTPUT SPEED</span><strong>{fmt(active.speed)}</strong><small>tokens / second</small></div><div><span>TTFT</span><strong>{active.latency?`${active.latency.toFixed(2)}s`:"N/A"}</strong><small>first chunk</small></div></div><div className="tags">{active.tags.map(t=><span key={t}>{t}</span>)}</div><div className="price-strip"><div><span>INPUT / 1M</span><b>${active.price.input.toFixed(2)}</b></div><div><span>OUTPUT / 1M</span><b>${active.price.output.toFixed(2)}</b></div><div><span>COST / AA TASK</span><b>${active.costTask.toFixed(2)}</b></div></div></article>
      </section>

      <section className="panel benchmark-panel" id="benchmarks"><div className="section-head"><div className="section-title"><span>03</span><div><h2>Benchmark scorecard</h2><p>Raw values, not a blended marketing score. Compare up to three models.</p></div></div><div className="compare-pills">{compare.map(m=><button key={m.id} onClick={()=>m.id!==active.id&&toggleCompare(m.id)}><i style={{background:m.color}}/>{m.name}<span>{m.id===active.id?"SELECTED":"×"}</span></button>)}</div></div><div className="benchmark-body"><div className="metric-legend">{compare.map(m=><span key={m.id}><i style={{background:m.color}}/>{m.name}</span>)}</div><MetricBar label="AA Intelligence" unit="index" items={compare} value={m=>m.intelligence} max={65}/><MetricBar label="Arena Text" unit="Elo" items={compare} value={m=>m.textElo} max={1550}/><MetricBar label="Code Arena · WebDev" unit="Elo" items={compare} value={m=>m.codeElo} max={1750}/><MetricBar label="Output speed" unit="tok/s" items={compare} value={m=>m.speed} max={230}/><MetricBar label="Latency to first chunk" unit="seconds" items={compare} value={m=>m.latency} max={170} invert/><MetricBar label="Evaluated cost / task" unit="$ / task" items={compare} value={m=>m.costTask} max={3.5} invert/></div></section>

      <section className="panel pricing-panel" id="pricing"><div className="section-head"><div className="section-title"><span>04</span><div><h2>Token economics</h2><p>Provider price per million tokens; live OpenRouter match with snapshot fallback.</p></div></div><button className={live?"feed-status":"feed-status offline"} onClick={refresh}><i/>{live?"LIVE FEED":"SNAPSHOT"}</button></div><div className="price-cards">{compare.map(m=><article key={m.id} style={{"--accent":m.color} as React.CSSProperties}><div className="card-name"><i/><span><b>{m.name}</b><small>{m.maker}</small></span></div><div className="price-pair"><div><span>INPUT</span><strong>${m.price.input.toFixed(2)}</strong></div><div><span>OUTPUT</span><strong>${m.price.output.toFixed(2)}</strong></div></div><div className="blended"><span>7:2:1 BLENDED</span><b>${(.7*m.price.cache+.2*m.price.input+.1*m.price.output).toFixed(2)}</b><i><em style={{width:`${Math.min(100,m.price.output/30*100)}%`}}/></i></div></article>)}</div></section>

      <section className="sources" id="sources"><div><span>05</span><h2>Sources & reading</h2></div><div className="source-grid">{Object.values(SOURCE_META).map(s=><a key={s.label} href={s.url} target="_blank" rel="noreferrer"><span>{s.label}</span><b>{s.date}</b><small>{"votes" in s?s.votes:"Public benchmark snapshot"}</small><em>↗</em></a>)}</div><p>Arena scores are human-preference Elo, not objective task accuracy. Artificial Analysis Intelligence is a separate independent composite. Missing values stay N/A; radar-only estimates are explicitly disclosed.</p></section>
      <footer><div><i/>Data layer operational</div><span>London · 31 Jul 2026 · UTC+1</span><a href="#ranking">Back to ranking ↑</a></footer>
    </div>
  </main>
}
