"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_QWEN_MODEL,
  type CompileResult,
  type PersonaCandidate,
  type PersonaRun,
  type ReasoningSpan,
} from "./protocol";
import styles from "./persona.module.css";

type ServiceStatus = {
  configured: boolean;
  protected: boolean;
  provider: "qwen";
  model: string;
  compiler_version: string;
};

type SavedCompile = {
  id: string;
  description: string;
  result: CompileResult;
};

const COMPILE_HISTORY_KEY = "quarkspace.persona.compile-history.v1";
const RUN_HISTORY_KEY = "quarkspace.persona.run-history.v1";
const ACCESS_TOKEN_KEY = "quarkspace.persona.access-token";
const DEFAULT_PROBES = "在吗\n你是谁\n今天在干嘛";

export default function PersonaLab() {
  const [service, setService] = useState<ServiceStatus | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [description, setDescription] = useState("");
  const [candidateCount, setCandidateCount] = useState(3);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [compileState, setCompileState] = useState<"idle" | "running">("idle");
  const [compileError, setCompileError] = useState("");
  const [probesText, setProbesText] = useState(DEFAULT_PROBES);
  const [repetitions, setRepetitions] = useState(1);
  const [runs, setRuns] = useState<PersonaRun[]>([]);
  const [runState, setRunState] = useState<"idle" | "running">("idle");
  const [runError, setRunError] = useState("");
  const [selectedRun, setSelectedRun] = useState(0);
  const [history, setHistory] = useState<SavedCompile[]>([]);

  useEffect(() => {
    fetch("/api/persona/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: ServiceStatus) => setService(value))
      .catch(() => setService(null));
    const storageTimer = window.setTimeout(() => {
      setAccessToken(sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? "");
      setHistory(readStorage<SavedCompile[]>(COMPILE_HISTORY_KEY, []));
      setRuns(readStorage<PersonaRun[]>(RUN_HISTORY_KEY, []));
    }, 0);
    return () => window.clearTimeout(storageTimer);
  }, []);

  const candidates = compileResult?.candidates ?? [];
  const selectedCandidate = candidates[selectedIndex] ?? null;
  const selectedValidation = selectedCandidate
    ? compileResult?.validation.candidates.find(
        (candidate) => candidate.candidate_id === selectedCandidate.candidate_id,
      )
    : null;
  const probes = useMemo(
    () => probesText.split("\n").map((probe) => probe.trim()).filter(Boolean),
    [probesText],
  );
  const plannedCalls = probes.length * repetitions;

  async function compile() {
    setCompileError("");
    setCompileState("running");
    setRuns([]);
    try {
      rememberAccessToken(accessToken);
      const result = await postJson<CompileResult>(
        "/api/persona/compile",
        { description, candidate_count: candidateCount },
        accessToken,
      );
      setCompileResult(result);
      setSelectedIndex(0);
      const saved: SavedCompile = {
        id: result.provenance.request_id ?? `${Date.now()}`,
        description,
        result,
      };
      const next = [saved, ...history.filter((item) => item.id !== saved.id)].slice(0, 8);
      setHistory(next);
      writeStorage(COMPILE_HISTORY_KEY, next);
    } catch (error) {
      setCompileError(error instanceof Error ? error.message : "生成失败");
    } finally {
      setCompileState("idle");
    }
  }

  async function runExperiment() {
    if (!selectedCandidate) return;
    setRunError("");
    setRunState("running");
    try {
      rememberAccessToken(accessToken);
      const result = await postJson<{ runs: PersonaRun[] }>(
        "/api/persona/run",
        { encoding: selectedCandidate.encoding, probes, repetitions },
        accessToken,
      );
      setRuns(result.runs);
      setSelectedRun(0);
      writeStorage(RUN_HISTORY_KEY, result.runs.slice(0, 12));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "实验失败");
    } finally {
      setRunState("idle");
    }
  }

  function loadHistory(item: SavedCompile) {
    setDescription(item.description);
    setCompileResult(item.result);
    setSelectedIndex(0);
    setRuns([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeRun = runs[selectedRun] ?? null;
  const serviceReady = Boolean(service?.configured && service?.protected);

  return (
    <div className={styles.lab}>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>ENCODE PERSONA / RESEARCH WORKBENCH</span>
          <h1>把角色 prompt 编译成可实验的语义编码</h1>
          <p>
            Qwen 默认生成多个不同粒度的候选。选中后，候选编码会原样发送给目标模型，探针和可观测推理轨迹分开保存。
          </p>
        </div>
        <div className={styles.serviceCard}>
          <span className={serviceReady ? styles.statusReady : styles.statusOff} />
          <div>
            <b>{service?.model ?? DEFAULT_QWEN_MODEL}</b>
            <small>
              {serviceReady ? "Qwen 编译与实验服务已就绪" : "等待服务器凭据配置"}
            </small>
          </div>
        </div>
      </section>

      <ol className={styles.steps} aria-label="实验流程">
        <li className={styles.stepActive}><b>01</b><span>输入角色 prompt</span></li>
        <li className={candidates.length ? styles.stepActive : ""}><b>02</b><span>筛选候选</span></li>
        <li className={runs.length ? styles.stepActive : ""}><b>03</b><span>运行探针实验</span></li>
      </ol>

      <section className={styles.workgrid}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>01</span><h2>自然语言角色设定</h2></div>
            <span className={styles.modelBadge}>DEFAULT · QWEN</span>
          </div>
          <label className={styles.field}>
            <span>访问口令</span>
            <div className={styles.secretField}>
              <input
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className={showAccessToken ? "" : styles.secretMasked}
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                placeholder="支持中文；只保存在当前浏览器会话"
              />
              <button
                type="button"
                aria-label={showAccessToken ? "隐藏访问口令" : "显示访问口令"}
                aria-pressed={showAccessToken}
                onClick={() => setShowAccessToken((visible) => !visible)}
              >
                {showAccessToken ? "隐藏" : "显示"}
              </button>
            </div>
          </label>
          <label className={styles.field}>
            <span>角色 prompt</span>
            <textarea
              className={styles.promptInput}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="粘贴完整角色设定。生成器会先建立事实账本，再生成 canonical、compact 和 atomized 候选。"
            />
          </label>
          <div className={styles.controlRow}>
            <label className={styles.fieldCompact}>
              <span>候选数量</span>
              <select value={candidateCount} onChange={(event) => setCandidateCount(Number(event.target.value))}>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </label>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={compile}
              disabled={compileState === "running" || description.trim().length < 20 || !accessToken}
            >
              {compileState === "running" ? "Qwen 正在生成…" : "生成 Encode Persona 候选"}
            </button>
          </div>
          {compileError && <p className={styles.error} role="alert">{compileError}</p>}
          <p className={styles.safetyNote}>访问口令不会写入历史或导出文件；服务端 Qwen API Key 不会发送到浏览器。</p>
        </div>

        <div className={`${styles.panel} ${styles.evidencePanel}`}>
          <div className={styles.panelHead}>
            <div><span>PROVENANCE</span><h2>生成证据</h2></div>
          </div>
          {compileResult ? (
            <>
              <dl className={styles.provenance}>
                <div><dt>模型</dt><dd>{compileResult.provenance.model}</dd></div>
                <div><dt>耗时</dt><dd>{compileResult.provenance.latency_ms.toLocaleString()} ms</dd></div>
                <div><dt>编译器</dt><dd>{compileResult.provenance.compiler_version}</dd></div>
                <div><dt>结构校验</dt><dd>{compileResult.validation.valid ? "通过" : "失败"}</dd></div>
                <div><dt>派生归一化</dt><dd>{compileResult.provenance.normalizations?.join("；") || "无"}</dd></div>
              </dl>
              <details className={styles.details}>
                <summary>事实账本 · {compileResult.extraction.facts.length} 条</summary>
                <div className={styles.factList}>
                  {compileResult.extraction.facts.map((fact) => (
                    <div key={fact.fact_id}>
                      <b>{fact.fact_id}</b>
                      <span>{fact.certainty}</span>
                      <p>{fact.source_quote}</p>
                    </div>
                  ))}
                </div>
              </details>
              <details className={styles.details}>
                <summary>observable reasoning trace</summary>
                <pre>{compileResult.provenance.reasoning_content || "此响应未返回 reasoning_content。"}</pre>
              </details>
              <details className={styles.details}>
                <summary>精确请求与原始响应</summary>
                <pre>{JSON.stringify({ request: compileResult.request, raw_response: compileResult.raw_response }, null, 2)}</pre>
              </details>
            </>
          ) : (
            <div className={styles.emptyState}>
              <span>⌁</span>
              <p>生成后，这里会显示模型、耗时、事实账本、推理轨迹和原始请求响应。</p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.candidateSection}>
        <div className={styles.sectionHead}>
          <div><span>02 / CANDIDATE SELECTION</span><h2>候选编码</h2></div>
          {compileResult && (
            <button className={styles.secondaryButton} type="button" onClick={() => downloadJson("encode-persona-candidates.json", { description, ...compileResult })}>
              导出 JSON
            </button>
          )}
        </div>
        {candidates.length ? (
          <div className={styles.candidateGrid}>
            {candidates.map((candidate, index) => {
              const check = compileResult?.validation.candidates[index];
              const selected = index === selectedIndex;
              return (
                <article className={`${styles.candidate} ${selected ? styles.candidateSelected : ""}`} key={candidate.candidate_id}>
                  <button className={styles.candidateSelect} type="button" onClick={() => { setSelectedIndex(index); setRuns([]); }} aria-pressed={selected}>
                    <span>{candidate.candidate_id}</span>
                    <b>{profileName(candidate)}</b>
                    <small>{check?.tag_count ?? 0} tags · {Math.round((check?.explicit_fact_coverage ?? 0) * 100)}% explicit coverage</small>
                  </button>
                  <pre>{candidate.encoding}</pre>
                  <div className={styles.candidateFoot}>
                    <span className={check?.valid ? styles.valid : styles.invalid}>{check?.valid ? "结构有效" : "校验失败"}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(candidate.encoding)}>复制</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyWide}>还没有候选。先输入角色 prompt，让 Qwen 生成 2–5 个不同粒度的版本。</div>
        )}
      </section>

      <section className={styles.experimentSection}>
        <div className={styles.sectionHead}>
          <div><span>03 / CONTROLLED PROBES</span><h2>直接实验选中的候选</h2></div>
          {selectedCandidate && <span className={styles.modelBadge}>{selectedCandidate.candidate_id} · 原样发送</span>}
        </div>
        <div className={styles.experimentGrid}>
          <div className={styles.panel}>
            <label className={styles.field}>
              <span>探针 · 每行一条</span>
              <textarea value={probesText} onChange={(event) => setProbesText(event.target.value)} />
            </label>
            <div className={styles.controlRow}>
              <label className={styles.fieldCompact}>
                <span>每条重复</span>
                <select value={repetitions} onChange={(event) => setRepetitions(Number(event.target.value))}>
                  <option value={1}>1 次</option>
                  <option value={2}>2 次</option>
                  <option value={3}>3 次</option>
                </select>
              </label>
              <div className={styles.callCount}><b>{plannedCalls}</b><span>计划调用</span></div>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!selectedCandidate || !selectedValidation?.valid || !accessToken || plannedCalls < 1 || plannedCalls > 6 || runState === "running"}
                onClick={runExperiment}
              >
                {runState === "running" ? "实验运行中…" : "在 Qwen Flash 上运行"}
              </button>
            </div>
            {plannedCalls > 6 && <p className={styles.error}>单次最多 6 次调用，请减少探针或重复次数。</p>}
            {runError && <p className={styles.error} role="alert">{runError}</p>}
            <p className={styles.safetyNote}>目标调用只包含一条 system 候选编码和当前 user 探针，不会附加“立即入戏”等增强指令。</p>
          </div>

          <div className={styles.runListPanel}>
            <div className={styles.runListHead}>
              <b>实验记录</b>
              {runs.length > 0 && <button type="button" onClick={() => downloadJson("encode-persona-runs.json", runs)}>导出 JSON</button>}
            </div>
            {runs.length ? runs.map((run, index) => (
              <button className={index === selectedRun ? styles.runActive : ""} type="button" key={run.run_id} onClick={() => setSelectedRun(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><b>{run.probe_text}</b><small>r{run.repetition} · {run.latency_ms.toLocaleString()} ms</small></div>
              </button>
            )) : <p>运行后会在这里按探针列出每次调用。</p>}
          </div>
        </div>

        {activeRun && <RunInspector run={activeRun} />}
      </section>

      <section className={styles.historySection}>
        <div className={styles.sectionHead}>
          <div><span>LOCAL HISTORY</span><h2>这个浏览器里的候选历史</h2></div>
          <small>最多保存 8 次，不同步到服务器</small>
        </div>
        {history.length ? (
          <div className={styles.historyList}>
            {history.map((item) => (
              <button type="button" key={item.id} onClick={() => loadHistory(item)}>
                <span>{new Date(item.result.provenance.timestamp).toLocaleString("zh-CN")}</span>
                <b>{item.description.slice(0, 86)}</b>
                <small>{item.result.candidates.length} candidates · {item.result.provenance.model}</small>
              </button>
            ))}
          </div>
        ) : <div className={styles.emptyWide}>这个浏览器还没有保存过编译结果。</div>}
      </section>
    </div>
  );
}

function RunInspector({ run }: { run: PersonaRun }) {
  const metric = run.metrics;
  return (
    <div className={styles.inspector}>
      <div className={styles.metrics}>
        <Metric label="PAL" value={metric.pal_heuristic === null ? "—" : `${metric.pal_heuristic}`} note="越低越直接" />
        <Metric label="MRR" value={formatRatio(metric.mrr_lexical)} note="元角色推理占比" />
        <Metric label="ICRR" value={formatRatio(metric.icrr_heuristic)} note="角色内推理占比" />
        <Metric label="DPE" value={metric.dpe_heuristic === null ? "—" : metric.dpe_heuristic ? "YES" : "NO"} note="是否直接入戏" />
      </div>
      <div className={styles.traceFlow}>
        <TraceBlock number="01" title="PROMPT" value={`${run.persona_prompt}\n\n[USER]\n${run.probe_text}`} />
        <span className={styles.flowArrow}>↓</span>
        <div className={styles.traceBlock}>
          <div><span>02</span><b>OBSERVABLE REASONING TRACE</b></div>
          <div className={styles.legend}>
            <span className={styles.meta}>META</span><span className={styles.reconstruction}>RECONSTRUCTION</span><span className={styles.inCharacter}>IN CHARACTER</span><span className={styles.task}>TASK</span>
          </div>
          <pre>{renderReasoning(run.reasoning_content, run.reasoning_spans)}</pre>
        </div>
        <span className={styles.flowArrow}>↓</span>
        <TraceBlock number="03" title="FINAL RESPONSE" value={run.content} />
      </div>
      <details className={styles.details}>
        <summary>本次调用的原始记录</summary>
        <pre>{JSON.stringify(run, null, 2)}</pre>
      </details>
    </div>
  );
}

function TraceBlock({ number, title, value }: { number: string; title: string; value: string }) {
  return (
    <div className={styles.traceBlock}>
      <div><span>{number}</span><b>{title}</b></div>
      <pre>{value || "（空）"}</pre>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div><span>{label}</span><b>{value}</b><small>{note}</small></div>;
}

function renderReasoning(text: string, spans: ReasoningSpan[]) {
  if (!text) return "此响应未返回 reasoning_content。";
  if (!spans.length) return text;
  const output: React.ReactNode[] = [];
  let position = 0;
  spans.forEach((span, index) => {
    if (span.start > position) output.push(text.slice(position, span.start));
    output.push(
      <mark className={spanClass(span.label)} key={`${span.start}-${index}`}>{text.slice(span.start, span.end)}</mark>,
    );
    position = span.end;
  });
  if (position < text.length) output.push(text.slice(position));
  return output;
}

function spanClass(label: ReasoningSpan["label"]): string {
  if (label === "META_PROMPT_INTERPRETATION") return styles.meta;
  if (label === "PERSONA_RECONSTRUCTION") return styles.reconstruction;
  if (label === "IN_CHARACTER_REASONING") return styles.inCharacter;
  if (label === "TASK_REASONING") return styles.task;
  return styles.other;
}

function profileName(candidate: PersonaCandidate): string {
  return candidate.profile.replaceAll("_", " ");
}

function formatRatio(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

async function postJson<T>(path: string, body: unknown, accessToken: string): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-persona-access-token": encodeURIComponent(accessToken),
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: ({ error?: string } & T) | null = null;
  try {
    payload = JSON.parse(raw) as { error?: string } & T;
  } catch {
    // EdgeOne can replace a timed-out function response with an HTML gateway page.
  }
  if (!response.ok) {
    const fallback = response.status === 504
      ? "Qwen 生成超时，请重试或减少候选数量。"
      : `请求失败：HTTP ${response.status}`;
    throw new Error(payload?.error || fallback);
  }
  if (!payload) throw new Error("服务器返回了无法解析的响应。");
  return payload;
}

function rememberAccessToken(value: string) {
  if (value) sessionStorage.setItem(ACCESS_TOKEN_KEY, value);
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full storage quota should not break the live experiment.
  }
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 500);
}
