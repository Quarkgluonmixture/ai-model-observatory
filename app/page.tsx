"use client";

import { useEffect, useMemo, useState } from "react";

type Model = {
  id: string; name: string; maker: string; color: string; score: number; delta: number;
  context: string; dims: number[]; price: { input: number; output: number; cache: number }; trend: number[];
};

const axes = ["Reasoning", "Coding", "Agents", "Vision", "Math", "Efficiency"];
const seed: Model[] = [
  { id: "gpt-5.6", name: "GPT-5.6", maker: "OpenAI", color: "#c88918", score: 98.7, delta: 1.6, context: "1M", dims: [98,97,99,94,97,72], price: { input: 1.25, output: 10, cache: .25 }, trend: [68,70,69,74,72,78,76,82,81,88,86,91,90,96,94,99] },
  { id: "claude-opus-5", name: "Claude Opus 5", maker: "Anthropic", color: "#148c72", score: 95.2, delta: .9, context: "200K", dims: [92,96,95,86,84,67], price: { input: 1.8, output: 15, cache: .36 }, trend: [72,71,75,73,76,80,78,84,82,86,85,90,88,93,91,95] },
  { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", maker: "Google", color: "#2b72dc", score: 92.4, delta: .7, context: "2M", dims: [89,88,87,98,91,79], price: { input: .9, output: 7, cache: .18 }, trend: [66,69,68,73,72,76,74,79,78,83,81,85,87,86,90,92] },
  { id: "deepseek-v4", name: "DeepSeek V4", maker: "DeepSeek", color: "#7558bd", score: 88.1, delta: -1.3, context: "256K", dims: [86,91,82,72,94,98], price: { input: .45, output: 2.2, cache: .09 }, trend: [72,75,74,78,77,80,79,84,82,86,83,87,85,89,87,88] },
  { id: "qwen-4-max", name: "Qwen 4 Max", maker: "Alibaba", color: "#68798d", score: 84, delta: .3, context: "1M", dims: [84,89,78,90,86,92], price: { input: .35, output: 1.7, cache: .07 }, trend: [70,69,72,73,74,76,75,78,77,80,79,82,81,83,82,84] },
];

const pp = (i: number, value: number, radius = 126) => {
  const a = Math.PI * 2 * i / 6 - Math.PI / 2;
  return [165 + Math.cos(a) * radius * value / 100, 153 + Math.sin(a) * radius * value / 100];
};
const poly = (values: number[]) => values.map((v, i) => pp(i, v).join(",")).join(" ");

function Spark({ values, color, large = false }: { values: number[]; color: string; large?: boolean }) {
  const w = large ? 220 : 82, h = large ? 64 : 28, lo = Math.min(...values) - 2, hi = Math.max(...values) + 2;
  const points = values.map((v, i) => `${i * w / (values.length - 1)},${h - (v - lo) * h / (hi - lo)}`).join(" ");
  return <svg className={large ? "spark large" : "spark"} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
    {large && <path className="spark-grid" d={`M0 ${h*.25}H${w}M0 ${h*.5}H${w}M0 ${h*.75}H${w}`} />}
    <polyline points={points} fill="none" stroke={color} strokeWidth={large ? 2.3 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function Radar({ models, selected, active }: { models: Model[]; selected: string[]; active: string }) {
  return <svg className="radar" viewBox="0 0 440 320" role="img" aria-label="Six-axis performance comparison">
    <g className="radar-grid">
      {[20,40,60,80,100].map(v => <polygon key={v} points={poly(Array(6).fill(v))} />)}
      {axes.map((_, i) => { const [x,y]=pp(i,100); return <line key={i} x1="165" y1="153" x2={x} y2={y}/>; })}
    </g>
    {models.filter(m => selected.includes(m.id)).map(m => <g key={m.id} className={m.id === active ? "series active" : "series"}>
      <polygon points={poly(m.dims)} fill={m.color} stroke={m.color}/>
      {m.dims.map((v,i) => { const [x,y]=pp(i,v); return <circle key={i} cx={x} cy={y} r={m.id===active?4:3} fill={m.color}><title>{axes[i]}: {v}</title></circle>; })}
    </g>)}
    {axes.map((axis,i) => { const [x,y]=pp(i,116); return <text key={axis} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{axis}</text>; })}
  </svg>;
}

export default function Home() {
  const [models, setModels] = useState(seed);
  const [activeId, setActiveId] = useState(seed[0].id);
  const [selected, setSelected] = useState(seed.slice(0,4).map(m=>m.id));
  const [range, setRange] = useState("7D");
  const [task, setTask] = useState("Overall");
  const [query, setQuery] = useState("");
  const [compare, setCompare] = useState(false);
  const [live, setLive] = useState(false);
  const [updated, setUpdated] = useState("connecting");
  const active = models.find(m=>m.id===activeId) ?? models[0];

  async function refreshPrices() {
    setUpdated("refreshing");
    try {
      const response = await fetch("/api/live-models", { cache: "no-store" });
      if (!response.ok) throw new Error("feed unavailable");
      const json = await response.json() as { prices: Record<string, {input:number;output:number;context?:string}> };
      setModels(current => current.map(m => json.prices[m.id] ? { ...m, price: { ...m.price, input: json.prices[m.id].input, output: json.prices[m.id].output }, context: json.prices[m.id].context || m.context } : m));
      setLive(true); setUpdated("just now");
    } catch { setLive(false); setUpdated("snapshot"); }
  }
  useEffect(() => { refreshPrices(); const timer=setInterval(refreshPrices,300000); return()=>clearInterval(timer); }, []);

  const ranked = useMemo(() => {
    const idx = axes.indexOf(task);
    return [...models].map(m=>({...m,display:idx<0?m.score:m.dims[idx]}))
      .filter(m=>`${m.name} ${m.maker}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a,b)=>b.display-a.display);
  },[models,task,query]);

  const toggle = (id:string) => {
    setSelected(now => now.includes(id) ? (now.length===1?now:now.filter(x=>x!==id)) : (now.length<4?[...now,id]:now));
    setActiveId(id);
  };

  return <main className="shell">
    <aside className="rail">
      <div className="logo">Ø</div>
      <nav>{[["⌁","Observatory"],["◇","Compare"],["△","Benchmarks"],["$","Pricing"],["≡","Sources"]].map(([icon,label],i)=><button className={i===0?"active":""} key={label} title={label} aria-label={label}>{icon}</button>)}</nav>
      <button className="settings" title="Settings" aria-label="Settings">⚙</button>
    </aside>
    <div className="workspace">
      <header>
        <div><p>FRONTIER INTELLIGENCE</p><h1>AI Model Observatory</h1></div>
        <div className="header-actions">
          <label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search models" /></label>
          <button className={live?"live":"live offline"} onClick={refreshPrices}><i/> {live?"LIVE":"SNAPSHOT"}<em>{updated}</em></button>
          <button className="round" aria-label="Notifications">●</button>
        </div>
      </header>

      <section className="pulse">
        <div className="pulse-label"><b>MARKET PULSE</b><small>Composite research index</small></div>
        <div className="ticker">{models.slice(0,4).map(m=><button key={m.id} onClick={()=>setActiveId(m.id)} className={activeId===m.id?"active":""}><span>{m.name}</span><strong>{m.score.toFixed(1)}</strong><em className={m.delta>=0?"up":"down"}>{m.delta>=0?"▲":"▼"} {Math.abs(m.delta).toFixed(1)}</em></button>)}</div>
      </section>

      <section className="main-grid">
        <article className="panel performance">
          <div className="panel-head">
            <div className="title"><span>01</span><div><h2>Performance Vector</h2><p>Normalized capability score · 0–100</p></div></div>
            <div className="controls"><div className="segments">{["24H","7D","30D"].map(x=><button key={x} className={range===x?"active":""} onClick={()=>setRange(x)}>{x}</button>)}</div><button className="compare" onClick={()=>setCompare(!compare)}>Compare ＋</button></div>
          </div>
          {compare&&<div className="compare-menu">{models.map(m=><label key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={()=>toggle(m.id)}/><i style={{background:m.color}}/>{m.name}</label>)}<small>Choose up to four</small></div>}
          <div className="radar-layout">
            <Radar models={models} selected={selected} active={activeId}/>
            <div className="legend">{models.filter(m=>selected.includes(m.id)).map(m=><button key={m.id} onClick={()=>setActiveId(m.id)} className={m.id===activeId?"active":""}><i style={{background:m.color}}/><b>{m.name}</b><em>{m.score.toFixed(1)}</em></button>)}<p>Hover a vertex for exact scores. Select a model to focus.</p></div>
          </div>
        </article>

        <article className="panel ranking">
          <div className="panel-head"><div className="title"><span>02</span><div><h2>Model Ranking</h2><p>Task-adjusted composite</p></div></div><select value={task} onChange={e=>setTask(e.target.value)}><option>Overall</option>{axes.map(a=><option key={a}>{a}</option>)}</select></div>
          <div className="rank-label"><span>RANK / MODEL</span><span>SCORE</span><span>TREND</span><span>Δ</span></div>
          <div className="rows">{ranked.map((m,i)=><button key={m.id} className={m.id===activeId?"rank active":"rank"} onClick={()=>setActiveId(m.id)}>
            <span className="num">{String(i+1).padStart(2,"0")}</span><span className="model"><i style={{background:m.color}}/><span><b>{m.name}</b><small>{m.maker} · {m.context}</small></span></span><strong>{m.display.toFixed(1)}</strong><Spark values={m.trend} color={m.color}/><em className={m.delta>=0?"up":"down"}>{m.delta>=0?"+":""}{m.delta.toFixed(1)}</em>
          </button>)}</div>
          <div className="method"><b>METHODOLOGY</b><span>Weighted benchmark snapshot · category selector recalculates rank</span></div>
        </article>
      </section>

      <section className="panel economics">
        <div className="panel-head"><div className="title"><span>03</span><div><h2>Token Economics</h2><p>USD per 1M tokens · OpenRouter live feed with snapshot fallback</p></div></div><div className="selected-model"><i style={{background:active.color}}/>{active.name}<small>{active.maker}</small></div></div>
        <div className="economics-grid">{([
          ["Input",active.price.input,active.trend],
          ["Output",active.price.output,active.trend.map((v,i)=>v+(i%3)*2)],
          ["Cache",active.price.cache,active.trend.map((v,i)=>v-(i%4)*1.5)]
        ] as [string,number,number[]][]).map(([label,price,trend])=><div className="price" key={label}><div><span>{label} / 1M</span><strong>${price.toFixed(2)}</strong><em className="up">↓ 4.8% <small>30D</small></em></div><Spark values={trend} color={active.color} large/></div>)}
        <div className="value"><span>VALUE INDEX</span><strong>{Math.round(active.score/(active.price.input+active.price.output)*10)}</strong><p>Performance points per blended dollar</p><div><i style={{width:`${Math.min(100,active.score/(active.price.input+active.price.output)*4)}%`,background:active.color}}/></div></div></div>
      </section>
      <footer><div><i/> Data layer operational</div><span>Performance: curated benchmark snapshot · Prices refresh every 5 min</span><a href="https://openrouter.ai/docs/guides/overview/models" target="_blank" rel="noreferrer">Sources & methodology ↗</a></footer>
    </div>
  </main>;
}
