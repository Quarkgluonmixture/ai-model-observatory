"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ACTIVE_ID,
  DEFAULT_COMPARE_IDS,
  LAST_RETRIEVED,
  AXES,
  BENCHMARKS,
  BENCHMARK_OBSERVATIONS,
  BENCHMARK_SCORES,
  MODELS,
  OBSERVATIONS_BY_CELL,
  SOURCE_META,
  SOURCE_STALE_DAYS,
  coreBenchmarksOf,
  portfolioFloor,
  type BenchmarkAxis,
  type BenchmarkMode,
  type BenchmarkRecord,
  type ModelRecord,
  type ObservationRow,
} from "../model-data";

type Lang = "zh" | "en";
type RankLens = "intelligence" | "agent" | "preference" | "coding" | "speed" | "value";

const UI = {
  zh: {
    eyebrow: "前沿智能 · 版本化观测",
    brand: "AI 模型观测站",
    search: "搜索模型或实验室",
    snapshot: "价格未对照",
    live: "已对照实时价",
    liveFresh: (n: number) => `实时:${n} 个新模型 · 价格已对照`,
    freshNote: "上游已在提供、目录还没有的模型:",
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
    controlled: "裸模型能力",
    best: "带 harness",
    controlledNote: "模型自己:单轮、无工具或统一设置",
    bestNote: "模型 + 最佳公开 scaffold + 工具",
    coverage: "数据覆盖",
    notIngested: "尚未接入",
    partialCoverage: "部分覆盖",
    broadCoverage: "广泛覆盖",
    coreMetrics: "项核心指标",
    observations: "条公开观测",
    noRadar: "该模型尚无足够的兼容 Benchmark 数据",
    hiddenBenchmarks: (n: number) => `已隐藏 ${n} 项:对比中的模型都还没有它的数据 · `,
    noBenchmarkData: "对比中的模型在这条能力轴上都还没有数据 · ",
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
    pricingDesc: "每百万 Token 的厂商标价，取自存档、可溯源；OpenRouter 实时价仅作对照，不覆盖目录数字。",
    input: "输入",
    output: "输出",
    blended: "7:2:1 混合价",
    liveDiffers: "OpenRouter 现价",
    liveMatches: "与 OpenRouter 一致",
    sources: "数据来源与可比性",
    read: "读取于",
    evaluated: "评测于",
    aging: "待复核",
    sourceNote: "“已接入”是数出来的，不是声明的：只有当存档里确实有来自该来源的观测行时才算接入，数字即行数。“接入队列”只是下一批采集目标，不参与现有分数。日期同样是数出来的：“读取于”是本项目最后一次抄录该来源的时间，“评测于”是该来源已发布的最新结果时间，两者不可互换。十六个批次中有十一个靠人工抄录、无法与上游自动比对，所以超过 30 天未读取的来源标为“待复核”——最近读过但评测日期很旧，说明的是该榜单本身没有更新。Arena 衡量人工偏好，系统类结果还同时反映 harness、工具与预算。",
    back: "返回排行 ↑",
    unavailable: "N/A",
    updated: (date: string) => `更新于 ${date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1 年 $2 月 $3 日").replace(/ 0/g, " ")}`,
    swipe: "表格可横向滑动查看全部指标",
    portfolioNote: "组合分要求覆盖该能力族至少一半的核心 Benchmark（且不少于 2 项）；达不到就记 N/A 并退出该排序，而不是拿更少的证据去和别人比。",
  },
  en: {
    eyebrow: "Frontier intelligence · versioned evidence",
    brand: "AI Model Observatory",
    search: "Search model or lab",
    snapshot: "Prices not compared",
    live: "Prices compared",
    liveFresh: (n: number) => `Live · ${n} new upstream · prices compared`,
    freshNote: "Served upstream, not yet in this catalog: ",
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
    controlled: "Model alone",
    best: "With harness",
    controlledNote: "The model itself: single-step, no tools, controlled setting",
    bestNote: "Model + its strongest public scaffold + tools",
    coverage: "Coverage",
    notIngested: "Not ingested",
    partialCoverage: "Partial",
    broadCoverage: "Broad",
    coreMetrics: "core metrics",
    observations: "public observations",
    noRadar: "Not enough compatible benchmark evidence for this model yet",
    hiddenBenchmarks: (n: number) => `${n} hidden — no compared model has data for them yet: `,
    noBenchmarkData: "No compared model has data on this axis yet: ",
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
    pricingDesc: "Vendor list price per million tokens, taken from the archive with provenance. OpenRouter's live figure is shown for comparison and never overwrites the catalog.",
    input: "Input",
    output: "Output",
    blended: "7:2:1 blended",
    liveDiffers: "OpenRouter now",
    liveMatches: "matches OpenRouter",
    sources: "Sources and comparability",
    read: "read",
    evaluated: "evaluated",
    aging: "AGING",
    sourceNote: "Connected is measured, not declared: a source counts only when observation rows in the archive came from it, and the number is that row count. Queued sources are ingestion targets and affect nothing. The dates are measured too: read is when this project last transcribed the source, evaluated is the newest published result, and the two are never interchanged. Eleven of the sixteen batches are hand-transcribed and cannot be diffed against upstream, so a source unread for 30 days is marked aging — a recently-read source with an old evaluation date means the leaderboard itself has been quiet. Arena measures preference; system results also reflect harness, tools and budget.",
    back: "Back to ranking ↑",
    unavailable: "N/A",
    updated: (date: string) => `Updated ${date}`,
    swipe: "Scroll the table sideways for every metric",
    portfolioNote: "A portfolio score needs at least half of that family's core benchmarks, and no fewer than two. Below that it stays N/A and leaves the ranking rather than competing on thinner evidence.",
  },
};

// The rail is the only navigation on a phone, where it becomes the bottom bar. Glyphs alone
// are unreadable there, so each entry carries a label that mobile CSS reveals.
const NAV: { id: string; glyph: string; zh: string; en: string }[] = [
  { id:"ranking", glyph:"⌁", zh:"排行", en:"Ranking" },
  { id:"model-detail", glyph:"◇", zh:"能力", en:"Capability" },
  { id:"benchmarks", glyph:"△", zh:"评测", en:"Benchmarks" },
  { id:"pricing", glyph:"$", zh:"价格", en:"Pricing" },
  { id:"sources", glyph:"≡", zh:"来源", en:"Sources" },
];

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
const variantsFor = (modelId: string, benchmarkId: string) => OBSERVATIONS_BY_CELL[modelId]?.[benchmarkId] ?? [];

// A cell can hold several non-mergeable runs (harness, effort, tools, context length).
// The table shows the primary value and exposes the alternates in the tooltip.
const cellTitle = (rows: ObservationRow[], fallback: string) => {
  if (!rows.length) return fallback;
  return rows
    .map((row, index) => {
      const parts = [
        `${index === 0 ? "▸" : "·"} ${row.score}`,
        row.benchmarkVersion,
        row.harness,
        row.reasoningEffort,
        row.contextLength,
        row.toolsEnabled === null ? null : row.toolsEnabled ? "tools" : "no tools",
        row.sourceLabel,
        row.evaluationDate,
      ].filter(Boolean);
      return parts.join(" · ") + (row.note ? `\n   ${row.note}` : "");
    })
    .join("\n");
};

// BENCHMARKS, BENCHMARK_SCORES and the axis taxonomy are module constants — a live price
// refresh replaces model records but never a score. So every derived number below is computed
// once and cached. Before this, one scroll-driven re-render re-filtered the 68-benchmark list
// about 120 times (27 rows × coding + agent, plus radar and coverage).
const memo = <T,>(compute: (key: string) => T) => {
  const cache = new Map<string, T>();
  return (key: string) => {
    if (!cache.has(key)) cache.set(key, compute(key));
    return cache.get(key) as T;
  };
};

const coreBenchmarks = memo((key: string) => {
  const [axis, mode] = key.split("|");
  return coreBenchmarksOf(axis as BenchmarkAxis | "*", mode as BenchmarkMode);
});

const axisScoreCached = memo((key: string) => {
  const [modelId, axis, mode] = key.split("|");
  const scores = scoresFor(modelId);
  const values = coreBenchmarks(`${axis}|${mode}`).flatMap(b => typeof scores[b.id] === "number" ? [normalized(b, scores[b.id] as number)] : []);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
});

function axisScore(modelId: string, axis: BenchmarkAxis, mode: BenchmarkMode) {
  return axisScoreCached(`${modelId}|${axis}|${mode}`);
}

// The coverage floor itself lives in model-data.ts, because scripts/report-gaps.mjs reads it
// to find the models sitting one cell below it. Below the floor an axis reads N/A and drops
// out of the lens, exactly as a model with no published cost per task is absent from the
// value lens rather than counted as free.
const axisCoverage = memo((key: string) => {
  const [modelId, axis, mode] = key.split("|");
  const scores = scoresFor(modelId);
  const core = coreBenchmarks(`${axis}|${mode}`);
  return { present: core.filter(b => typeof scores[b.id] === "number").length, total: core.length };
});

function portfolioCoverage(modelId: string, axis: BenchmarkAxis) {
  return axisCoverage(`${modelId}|${axis}|system`);
}

function portfolioScore(modelId: string, axis: BenchmarkAxis) {
  const { present, total } = portfolioCoverage(modelId, axis);
  if (!total || present < portfolioFloor(total)) return null;
  return axisScore(modelId, axis, "system");
}

const coverageCached = memo((key: string) => {
  const [modelId, mode] = key.split("|");
  const scores = scoresFor(modelId);
  const core = coreBenchmarks(`*|${mode}`);
  const present = core.filter(b => typeof scores[b.id] === "number").length;
  const pct = core.length ? Math.round(present / core.length * 100) : 0;
  const status = present === 0 ? "uncollected" : pct < 50 ? "partial" : "broad";
  return { present, total: core.length, pct, status } as const;
});

function coverageFor(modelId: string, mode: BenchmarkMode) {
  return coverageCached(`${modelId}|${mode}`);
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
  // A model with no published cost per task is absent from the value lens, not free — and the
  // same holds when AA has not measured its intelligence index: value is a ratio of the two, so
  // either half missing makes the ratio unpublishable rather than zero.
  if (lens === "value") {
    if (model.costTask === null || model.intelligence === null) return -1;
    return model.intelligence / Math.max(0.01, model.costTask);
  }
  return model.intelligence ?? -1;
}

function rankValue(model: ModelRecord, lens: RankLens) {
  const value = rankScore(model, lens);
  if (value < 0) return "N/A";
  if (lens === "preference") return `${Math.round(value)}`;
  if (lens === "speed") return `${Math.round(value)} t/s`;
  if (lens === "value") return `${Math.round(value)}×`;
  return value.toFixed(1);
}

// The viewBox is wider than the plot so a seven-character axis label ("长上下文与记忆") has room
// on both sides. On desktop the fixed 350px height letterboxes the SVG and hides a tight box; on
// a phone height is auto, the box is exactly the viewBox, and anything overhanging is clipped.
const CENTER_X = 250;
const CENTER_Y = 160;
const radius = 118;
const radarPoint = (i: number, value: number, scale = radius) => {
  const angle = Math.PI * 2 * i / AXES.length - Math.PI / 2;
  return [CENTER_X + Math.cos(angle) * scale * value / 100, CENTER_Y + Math.sin(angle) * scale * value / 100];
};
const radarPolygon = (value: number) => AXES.map((_, i) => radarPoint(i, value).join(",")).join(" ");

function Radar({ models, activeId, mode, lang }:{ models: ModelRecord[]; activeId: string; mode: BenchmarkMode; lang: Lang }) {
  const ui = UI[lang];
  const activeValues = AXES.map(a => axisScore(activeId, a.id, mode));
  const hasActive = activeValues.filter(v => v !== null).length >= 3;
  return <svg className="radar" viewBox="0 0 500 340" role="img" aria-label={lang === "zh" ? "七维能力雷达图" : "Seven-axis capability radar"}>
    <g className="radar-grid">
      {[20,40,60,80,100].map(v => <polygon key={v} points={radarPolygon(v)} />)}
      {AXES.map((_,i) => { const [x,y] = radarPoint(i,100); return <line key={i} x1={CENTER_X} y1={CENTER_Y} x2={x} y2={y}/>; })}
    </g>
    {models.map(model => {
      const values = AXES.map(a => axisScore(model.id, a.id, mode));
      const points = values.map((v,i) => v === null ? null : radarPoint(i, v));
      const complete = values.every(v => v !== null);
      // A missing axis used to collapse the whole series to loose dots, which made the model-alone
      // lens — the one with the sparser evidence — look broken rather than partial. Now the outline
      // is drawn between axes that BOTH have a score and simply breaks where one does not, so the
      // shape is readable without any segment implying a number nobody published. The fill stays
      // for complete series only: shading a broken outline would state an area that is not measured.
      const edges = AXES.map((_,i) => [points[i], points[(i + 1) % AXES.length]] as const)
        .filter((edge): edge is readonly [number[], number[]] => Boolean(edge[0] && edge[1]));
      return <g key={model.id} className={model.id === activeId ? "radar-series active" : "radar-series"}>
        {complete
          ? <polygon points={points.map(p => p!.join(",")).join(" ")} fill={model.color} stroke={model.color}/>
          : edges.map(([a,b],i) => <line key={i} className="radar-edge" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={model.color}/>)}
        {points.map((p,i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={model.id === activeId ? 4 : 3} fill={model.color}><title>{AXES[i][lang]}: {(values[i] as number).toFixed(1)}</title></circle>)}
      </g>;
    })}
    {AXES.map((axis,i) => { const [x,y] = radarPoint(i,113,136); return <text key={axis.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{axis[lang]}</text>; })}
    {!hasActive && <g className="radar-empty"><circle cx={CENTER_X} cy={CENTER_Y} r="53"/><text x={CENTER_X} y={CENTER_Y-5} textAnchor="middle">N/A</text><text x={CENTER_X} y={CENTER_Y+14} textAnchor="middle">{ui.noRadar}</text></g>}
  </svg>;
}

export type LivePrices = Record<string, { input: number; output: number; contextK?: number; source: string }>;
export type FreshModel = { id: string; name: string; published: string };

// A provider quoting a different number than the archive is the interesting case, and it has two
// causes worth telling apart by hand: the vendor changed its list price (collect it) or the
// provider is quoting something the catalog deliberately excludes, such as the Claude Sonnet 5
// introductory rate or a reseller's own margin (leave it). Neither is a reason to overwrite.
//
// The tolerance keeps float noise out of the comparison: OpenRouter returns per-token strings,
// so $0.10 arrives as 0.09999999999999999 and would otherwise read as a disagreement.
function priceComparison(model: ModelRecord, livePrices: LivePrices) {
  const live = livePrices[model.id];
  if (!live) return null;
  const apart = (mine: number, theirs: number) => Math.abs(mine - theirs) > Math.max(0.0001, mine * 0.005);
  return { ...live, differs: apart(model.price.input, live.input) || apart(model.price.output, live.output) };
}

// What a source card prints as its date. A hand-written label ("2026", "live") cannot go stale
// visibly, which is the problem: it reads as current forever. So the card shows the date the rows
// actually carry, and says which kind of date it is rather than blurring the two.
//
// `staleBefore` arrives from an effect rather than from render, because the page is prerendered:
// comparing against the clock during render would make the server and the browser disagree.
// Until it lands, nothing is marked — an unflagged card is never a false reassurance, it is a
// card whose flag has not been computed yet.
function freshnessOf(source: (typeof SOURCE_META)[string], lang: Lang, staleBefore: string | null) {
  const ui = UI[lang];
  const iso = source.lastRetrieved ?? source.lastEvaluated;
  if (!iso) return { text: source.date, title: source.role, stale: false };
  return {
    text: `${source.lastRetrieved ? ui.read : ui.evaluated} ${iso}`,
    title: `${ui.read}: ${source.lastRetrieved ?? UI[lang].unavailable} · ${ui.evaluated}: ${source.lastEvaluated ?? UI[lang].unavailable}`,
    stale: staleBefore !== null && iso < staleBefore,
  };
}

// The ranking cell carries its own evidence count, so a reader can see that 4/5 sits next to
// 5/5 and that an N/A is a coverage floor rather than a missing model.
function PortfolioCell({ modelId, axis }: { modelId: string; axis: BenchmarkAxis }) {
  const value = portfolioScore(modelId, axis);
  const { present, total } = portfolioCoverage(modelId, axis);
  return <span className={value === null ? "portfolio sparse" : "portfolio"}>{value === null ? "N/A" : value.toFixed(1)}<small>{present}/{total}</small></span>;
}

function BenchmarkChart({ models, axis, mode, lang }:{ models: ModelRecord[]; axis: BenchmarkAxis; mode: BenchmarkMode; lang: Lang }) {
  const ui = UI[lang];
  const inAxis = BENCHMARKS.filter(b => b.axis === axis && b.tier !== "legacy" && (mode === "system" || b.mode === "model"));
  // A column no compared model has any score for contributes nothing but width: it stretches the
  // x-axis and flattens every line on the chart, which is the opposite of what the panel is for.
  // Hidden, not silently — an uncollected benchmark is a fact about this catalog and it is named
  // below the chart. Nothing here is zero-filled; the column simply is not drawn.
  const metrics = inAxis.filter(b => models.some(model => typeof scoresFor(model.id)[b.id] === "number"));
  const hidden = inAxis.filter(b => !metrics.includes(b));
  const width = Math.max(780, metrics.length * 126 + 90);
  const x = (i: number) => 66 + i * ((width - 110) / Math.max(1, metrics.length - 1));
  const y = (value: number) => 24 + (100 - value) * 1.72;
  if (metrics.length === 0) {
    return <div className="benchmark-chart-shell"><p className="chart-empty">{ui.noBenchmarkData}<span>{inAxis.map(b => b.name).join(" · ")}</span></p></div>;
  }
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
    <p className="scroll-hint">{ui.swipe}</p>
    {hidden.length > 0 && <p className="chart-hidden">{ui.hiddenBenchmarks(hidden.length)}<span>{hidden.map(b => b.name).join(" · ")}</span></p>}
    <div className="score-table-wrap"><table className="score-table"><thead><tr><th>{lang === "zh" ? "模型" : "Model"}</th>{metrics.map(b => <th key={b.id}>{b.name}<small>{b.version}</small></th>)}</tr></thead><tbody>{models.map(model => <tr key={model.id}><th><i style={{background:model.color}}/>{model.name}</th>{metrics.map(b => { const v=scoresFor(model.id)[b.id]; const observation=observationsFor(model.id)[b.id]; const rows=variantsFor(model.id, b.id); return <td key={b.id} className={observation ? `sourced ${observation.sourceKind}` : "missing"} title={cellTitle(rows, ui.notIngested)}>{typeof v === "number" ? <>{v}{b.unit}<small>{observation?.sourceKind}{rows.length > 1 ? ` +${rows.length - 1}` : ""}</small></> : ui.unavailable}</td>; })}</tr>)}</tbody></table></div>
  </div>;
}

export default function Home() {
  const [lang,setLang] = useState<Lang>("zh");
  const [activeSection,setActiveSection] = useState("ranking");
  const [catalogOpen,setCatalogOpen] = useState(false);
  // The catalog is not live state. Its prices are archived list prices with provenance behind
  // them (npm run check:models), so the feed no longer writes into this array — see refresh().
  const models = MODELS;
  const [activeId,setActiveId] = useState(DEFAULT_ACTIVE_ID);
  const [compareIds,setCompareIds] = useState<string[]>(DEFAULT_COMPARE_IDS);
  const [lens,setLens] = useState<RankLens>("intelligence");
  const [profileMode,setProfileMode] = useState<BenchmarkMode>("system");
  const [axis,setAxis] = useState<BenchmarkAxis>("coding");
  const [query,setQuery] = useState("");
  const [maker,setMaker] = useState("All labs");
  const [openOnly,setOpenOnly] = useState(false);
  const [showAll,setShowAll] = useState(false);
  const [livePrices,setLivePrices] = useState<LivePrices>({});
  // Models a provider is already serving that this catalog has never heard of. The daily job finds
  // them tomorrow morning; this finds them now, and says so rather than pretending the board is
  // complete. It is a pointer, not data: nothing here reaches a cell.
  const [fresh,setFresh] = useState<FreshModel[]>([]);
  const [live,setLive] = useState(false);
  const [updated,setUpdated] = useState("snapshot");
  const ui = UI[lang];
  const active = models.find(x => x.id === activeId) ?? models[0];
  const compare = [active, ...compareIds.filter(id => id !== active.id).map(id => models.find(m => m.id === id)).filter(Boolean) as ModelRecord[]].slice(0,3);
  const makers = ["All labs", ...Array.from(new Set(models.map(x => x.maker)))];
  const coverage = coverageFor(active.id, profileMode);
  const codingCoverage = portfolioCoverage(active.id, "coding");
  const agentCoverage = portfolioCoverage(active.id, "agent");

  // The cutoff a source card is measured against, resolved after mount so a prerendered page
  // and a browser three weeks later do not disagree about what "30 days ago" means.
  const [staleBefore,setStaleBefore] = useState<string | null>(null);
  useEffect(() => { const frame=requestAnimationFrame(() => setStaleBefore(new Date(Date.now() - SOURCE_STALE_DAYS * 86400000).toISOString().slice(0,10))); return () => cancelAnimationFrame(frame); }, []);
  const sourceCards = useMemo(() => Object.values(SOURCE_META).map(source => ({ source, freshness: freshnessOf(source, lang, staleBefore) })), [lang, staleBefore]);
  const agingCount = sourceCards.filter(card => card.freshness.stale).length;

  const lastFetch = useRef(0);

  // The feed is a second opinion, not an authority. It used to overwrite `price` and `contextK`
  // on the model record, which quietly broke two of this project's own rules: the catalog quotes
  // list price and never a promotion (OpenRouter serves Claude Sonnet 5 at its $2/$10 introductory
  // rate), and every catalog number is backed by an archive row (npm run check:models), which a
  // number arriving at runtime is not. So the live figures are held beside the catalog and shown
  // where they disagree — a disagreement is a signal to go collect, not a number to display.
  async function refresh() {
    lastFetch.current = Date.now();
    setUpdated("refreshing");
    try {
      const res = await fetch("/api/live-models",{cache:"no-store"});
      if (!res.ok) throw new Error();
      const data = await res.json() as { prices: LivePrices; fresh?: FreshModel[] };
      setLivePrices(data.prices);
      setFresh(data.fresh ?? []);
      setLive(true); setUpdated("just now");
    } catch { setLive(false); setUpdated("snapshot"); }
  }

  // A phone keeps this tab alive in the background for a long time. Polling a price feed there
  // spends radio and battery on a screen nobody is looking at, so the interval only fires while
  // the document is visible, and a return to the tab refreshes only if the snapshot is stale.
  useEffect(() => {
    const PERIOD = 300000;
    const tick = () => { if (document.visibilityState === "visible") refresh(); };
    const initial = setTimeout(tick, 0);
    const timer = setInterval(tick, PERIOD);
    const onVisibility = () => { if (document.visibilityState === "visible" && Date.now() - lastFetch.current > PERIOD) refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearTimeout(initial); clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);
  useEffect(() => { const saved=localStorage.getItem("observatory-language"); const frame=requestAnimationFrame(() => { if(saved === "zh" || saved === "en") setLang(saved); }); return () => cancelAnimationFrame(frame); }, []);
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; }, [lang]);
  useEffect(() => {
    const sectionIds = NAV.map(item => item.id);
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
  // An unmeasured model cannot lead a lens it has no number on, so null sorts last here rather
  // than arithmetic-ing itself to the top of the brief.
  const leader = [...models].filter(m => m.intelligence !== null).sort((a,b) => (b.intelligence??0)-(a.intelligence??0))[0];
  const fastest = [...models].filter(m => m.speed !== null).sort((a,b) => (b.speed??0)-(a.speed??0))[0];
  const bestValue = [...models].sort((a,b) => rankScore(b,"value")-rankScore(a,"value"))[0];

  return <main className="shell">
    <aside className="rail"><div className="logo">Ø</div><nav>{NAV.map(item => <a key={item.id} className={activeSection===item.id?"active":""} href={`#${item.id}`} aria-label={item.en} aria-current={activeSection===item.id?"page":undefined} onClick={()=>setActiveSection(item.id)}><i aria-hidden="true">{item.glyph}</i><span>{item[lang]}</span></a>)}</nav></aside>
    <div className="workspace">
      <header><div><p>{ui.eyebrow}</p><h1>{ui.brand}</h1></div><div className="header-actions"><label className="search"><span aria-hidden="true">⌕</span><input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} aria-label={ui.search} value={query} onChange={e=>setQuery(e.target.value)} placeholder={ui.search}/></label><div className="lang-switch" aria-label="Language"><button className={lang==="zh"?"active":""} onClick={()=>changeLang("zh")}>中</button><button className={lang==="en"?"active":""} onClick={()=>changeLang("en")}>EN</button></div><button className={live?(fresh.length?"live has-fresh":"live"):"live offline"} onClick={refresh}><i/>{live?(fresh.length?ui.liveFresh(fresh.length):ui.live):ui.snapshot}<em>{updated}</em></button></div></header>

      <section className="brief">
        <div><span>{ui.tracked}</span><strong>{models.length}</strong><small>frontier models</small></div>
        <div><span>{ui.portfolio}</span><strong>{BENCHMARKS.length}</strong><small>7 capability families</small></div>
        <div><span>AA Intelligence</span><strong>{leader.name}</strong><small>{leader.intelligence} · {leader.maker}</small></div>
        <div><span>{lang === "zh" ? "输出速度最快" : "Fastest output"}</span><strong>{fastest.name}</strong><small>{fastest.speed} output tok/s</small></div>
        <div><span>{lang === "zh" ? "最佳性价比" : "Best value"}</span><strong>{bestValue.name}</strong><small>{bestValue.costTask === null ? ui.unavailable : `$${bestValue.costTask.toFixed(2)} / AA task`}</small></div>
      </section>

      <section className="panel ranking-panel" id="ranking">
        <div className="section-head"><div className="section-title"><span>01</span><div><h2>{ui.ranking}</h2><p>{ui.rankingDesc}</p></div></div><div className="source-stamp"><i/>{ui.updated(LAST_RETRIEVED)}</div></div>
          {fresh.length > 0 && <p className="fresh-note">{ui.freshNote}{fresh.map(model => <span key={model.id}>{model.name}<small>{model.published}</small></span>)}</p>}
        <div className="rank-toolbar"><div className="metric-tabs">{LENSES.map(item => <button key={item.id} className={lens===item.id?"active":""} onClick={()=>setLens(item.id)}><span>{item[lang]}</span><b>{lang === "zh" ? item.shortZh : item.shortEn}</b></button>)}</div><div className="filters"><select value={maker} onChange={e=>setMaker(e.target.value)} aria-label="Lab filter">{makers.map(x => <option key={x} value={x}>{x === "All labs" ? ui.allLabs : x}</option>)}</select><label><input type="checkbox" checked={openOnly} onChange={e=>setOpenOnly(e.target.checked)}/>{ui.open}</label></div></div>
        <div className="rank-head"><span>#</span><span>{lang === "zh" ? "模型" : "Model"}</span><span>{lensName}</span><span>AA</span><span>Arena</span><span>{lang === "zh" ? "编程组合" : "Coding"}</span><span>Agent</span><span>{lang === "zh" ? "速度" : "Speed"}</span><span>{ui.compare}</span></div>
        <div className="rank-list">{visible.map((model,index) => {
          return <article className={activeId===model.id?"rank-row active":"rank-row"} key={model.id}>
            <button className="rank-main" onClick={()=>selectModel(model.id)}>
              <span className="position">{String(index+1).padStart(2,"0")}</span><span className="model-id"><i style={{background:model.color}}/><span><b>{model.name}</b><small>{model.maker}{model.open?" · OPEN":""}</small></span></span>
              <strong className="lens-value">{rankValue(model,lens)}</strong><span>{model.intelligence ?? "N/A"}</span><span>{model.textElo ?? "N/A"}</span><PortfolioCell modelId={model.id} axis="coding"/><PortfolioCell modelId={model.id} axis="agent"/><span>{model.speed === null ? "N/A" : `${model.speed}`}</span>
            </button>
            <div className="mobile-metrics"><span>AA {model.intelligence ?? "N/A"}</span><span>Arena {model.textElo ?? "N/A"}</span><span>{lensName} {rankValue(model,lens)}</span></div>
            <label className="compare-check"><input type="checkbox" checked={compareIds.includes(model.id)} disabled={model.id===activeId} onChange={()=>toggleCompare(model.id)}/><span>{ui.compare}</span></label>
          </article>;
        })}</div>
        {ranked.length > 10 && <button className="show-all" onClick={()=>setShowAll(x=>!x)}>{showAll?ui.hide:ui.show}<span>{showAll?"↑":"↓"}</span></button>}
        <div className="rank-foot"><span>{ui.current}</span><strong>{lensName}</strong><p>{lens === "preference" ? (lang === "zh" ? "Arena 是人工偏好 Elo，不等同于任务正确率。" : "Arena is human-preference Elo, not task accuracy.") : lens === "agent" || lens === "coding" ? ui.portfolioNote : (lang === "zh" ? "N/A 保持缺失，不参与当前排序。" : "N/A remains missing and does not enter this ranking.")}</p></div>
      </section>

      <section className="detail-grid" id="model-detail">
        <article className="panel radar-panel">
          <div className="section-head"><div className="section-title"><span>02</span><div><h2>{ui.capability}</h2><p>{ui.capabilityDesc}</p></div></div><div className="mode-switch"><button className={profileMode==="model"?"active":""} onClick={()=>setProfileMode("model")}><b>{ui.controlled}</b><span>{ui.controlledNote}</span></button><button className={profileMode==="system"?"active":""} onClick={()=>setProfileMode("system")}><b>{ui.best}</b><span>{ui.bestNote}</span></button></div></div>
          <div className="radar-layout"><Radar models={compare} activeId={activeId} mode={profileMode} lang={lang}/><div className="radar-side"><div className={`coverage-card ${coverage.status}`}><span>{ui.coverage}</span><strong>{coverageText(active.id,profileMode,lang)}</strong><div><i style={{width:`${coverage.pct}%`}}/></div><small>{coverage.status === "uncollected" ? ui.notIngested : `${coverage.present} / ${coverage.total} ${ui.coreMetrics} · ${coverage.status === "partial" ? ui.partialCoverage : ui.broadCoverage}`}</small></div><div className="legend">{compare.map(model => <button key={model.id} className={model.id===activeId?"active":""} onClick={()=>setActiveId(model.id)}><i style={{background:model.color}}/><span><b>{model.name}</b><small>{model.maker}</small></span><em>{coverageText(model.id,profileMode,lang)}</em></button>)}</div></div></div>
        </article>
        <aside className="panel dossier"><div className="dossier-top"><span>{lang === "zh" ? "当前模型" : "Selected model"}</span><h2>{active.name}</h2><p>{active.maker} · {active.open ? "OPEN WEIGHTS" : "PROPRIETARY"}</p></div><div className="kpis"><div><span>AA INTELLIGENCE</span><strong>{active.intelligence ?? "N/A"}</strong><small>{active.intelligence === null ? (lang === "zh" ? "AA 尚未测量" : "not measured by AA yet") : "independent composite"}</small></div><div><span>ARENA TEXT</span><strong>{active.textElo ?? "N/A"}</strong><small>human preference Elo</small></div><div><span>CODING PORTFOLIO</span><strong>{portfolioScore(active.id,"coding")?.toFixed(1) ?? "N/A"}</strong><small>best-system · {codingCoverage.present}/{codingCoverage.total} core</small></div><div><span>AGENT PORTFOLIO</span><strong>{portfolioScore(active.id,"agent")?.toFixed(1) ?? "N/A"}</strong><small>best-system · {agentCoverage.present}/{agentCoverage.total} core</small></div></div><div className="tags">{active.tags.map(tag=><span key={tag}>{tag}</span>)}</div>{active.configurations.length > 1 && <div className="configs"><span>{lang === "zh" ? "已发布的运行档位" : "Published operating points"}</span><ul>{active.configurations.map(config=><li key={config.effort ?? "default"}><b>{config.effort ?? "default"}</b><em>{config.intelligence ?? "N/A"}</em><small>{config.costTask === null ? "" : `$${formatUsd(config.costTask)}/task`}{config.latency === null ? "" : `${config.costTask === null ? "" : " · "}${config.latency}s`}</small></li>)}</ul></div>}<div className="price-strip"><div><span>{ui.input}</span><b>${formatUsd(active.price.input)}</b></div><div><span>{ui.output}</span><b>${formatUsd(active.price.output)}</b></div><div><span>CONTEXT</span><b>{active.contextK >= 1000 ? `${(active.contextK/1000).toFixed(1)}M` : `${active.contextK}K`}</b></div></div></aside>
      </section>

      <section className="panel benchmark-panel" id="benchmarks">
        <div className="section-head"><div className="section-title"><span>03</span><div><h2>{ui.benchmark}</h2><p>{ui.benchmarkDesc}</p></div></div><div className="compare-pills">{compare.map(model=>{const count=Object.keys(observationsFor(model.id)).length;return <button key={model.id} onClick={()=>setActiveId(model.id)}><i style={{background:model.color}}/>{model.name}<span>{count ? `${count} ${ui.observations}` : ui.notIngested}</span></button>;})}</div></div>
        <div className="benchmark-toolbar"><div className="axis-tabs">{AXES.map(item => <button key={item.id} className={axis===item.id?"active":""} onClick={()=>setAxis(item.id)}><span>{item[lang]}</span><b>{item.weight}%</b></button>)}</div><div className="mode-compact"><button className={profileMode==="model"?"active":""} onClick={()=>setProfileMode("model")}>{ui.controlled}</button><button className={profileMode==="system"?"active":""} onClick={()=>setProfileMode("system")}>{ui.best}</button></div></div>
        <div className="benchmark-body"><BenchmarkChart models={compare} axis={axis} mode={profileMode} lang={lang}/></div>
      </section>

      <section className="panel pricing-panel" id="pricing"><div className="section-head"><div className="section-title"><span>04</span><div><h2>{ui.pricing}</h2><p>{ui.pricingDesc}</p></div></div><button className={live?"feed-status":"feed-status offline"} onClick={refresh}><i/>{live?ui.live:ui.snapshot}</button></div><div className="price-cards">{compare.map(model => { const blended=model.price.input*.7+model.price.output*.2+model.price.cache*.1; const comparison=priceComparison(model,livePrices); return <article key={model.id} style={{"--accent":model.color} as React.CSSProperties}><div className="card-name"><i/><span><b>{model.name}</b><small>{model.maker}</small></span></div><div className="price-pair"><div><span>{ui.input}</span><strong>${formatUsd(model.price.input)}</strong></div><div><span>{ui.output}</span><strong>${formatUsd(model.price.output)}</strong></div></div>{comparison&&<div className={comparison.differs?"live-compare differs":"live-compare"} title={comparison.source}>{comparison.differs?`${ui.liveDiffers} $${formatUsd(comparison.input)} / $${formatUsd(comparison.output)}`:ui.liveMatches}</div>}<div className="blended"><span>{ui.blended}</span><b>${formatUsd(blended)}</b><i><em style={{width:`${Math.min(100,blended/8*100)}%`}}/></i></div></article>; })}</div></section>

      <section className="panel catalog-panel">
        <div className="section-head"><div className="section-title"><span>05</span><div><h2>{ui.catalog}</h2><p>{ui.catalogDesc}</p></div></div><div className="catalog-actions"><div className="catalog-count">{BENCHMARKS.filter(b=>b.tier==="core").length} CORE · {BENCHMARKS.filter(b=>b.tier==="observe").length} OBSERVE</div><button className="catalog-toggle" type="button" aria-expanded={catalogOpen} onClick={()=>setCatalogOpen(open=>!open)}>{catalogOpen ? (lang==="zh"?"收起目录":"Collapse catalog") : (lang==="zh"?`展开 ${BENCHMARKS.length} 项`:`Show ${BENCHMARKS.length} items`)}<span>{catalogOpen?"↑":"↓"}</span></button></div></div>
        {catalogOpen && <div className="catalog-grid">{BENCHMARKS.map(b => <a className={`catalog-card ${b.tier}`} href={b.url} target="_blank" rel="noreferrer" key={b.id}><div><span className={`tier ${b.tier}`}>{ui[b.tier]}</span><span className={`method ${b.method}`}>{b.method === "execution" ? ui.exec : b.method === "exam" ? ui.exam : b.method === "rubric" ? ui.rubric : ui.preference}</span></div><h3>{b.name}</h3><p>{b[lang]}</p><footer><span>{AXES.find(a=>a.id===b.axis)?.[lang]}</span><b>{b.mode === "model" ? ui.modelMode : ui.systemMode}</b><em>{b.version} ↗</em></footer></a>)}</div>}
      </section>

      <section className="sources" id="sources"><div><span>06</span><h2>{ui.sources}</h2><div className="source-summary"><b>{sourceCards.filter(card=>card.source.status==="active").length} {lang==="zh"?"已接入":"CONNECTED"}</b><span>{sourceCards.filter(card=>card.source.status==="queued").length} {lang==="zh"?"接入队列":"QUEUED"}</span>{agingCount>0&&<span className="aging">{agingCount} {ui.aging}</span>}</div></div><div className="source-grid">{sourceCards.map(({source,freshness})=><a className={source.status} href={source.url} target="_blank" rel="noreferrer" key={source.label}><div><span className={freshness.stale?"aging":undefined} title={freshness.title}>{freshness.text}</span><i>{source.status==="active"?`${lang==="zh"?"已接入":"CONNECTED"}${source.observations?` · ${source.observations}`:""}`:(lang==="zh"?"接入队列":"QUEUED")}</i></div><b>{source.label}</b><small>{source.role}</small><em>↗</em></a>)}</div><p>{ui.sourceNote}</p></section>
      <footer className="site-footer"><div><i/>{lang === "zh" ? "每日自动刷新 · 最后读取" : "REFRESHED DAILY · LAST READ"} {LAST_RETRIEVED}</div><span>AI Model Observatory</span><a href="#ranking">{ui.back}</a></footer>
    </div>
  </main>;
}
