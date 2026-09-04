"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./agent-101.module.css";
import c from "./concrete.module.css";

type SectionId = "api" | "agent" | "skill" | "github" | "mcp" | "modeling";
type ApiArtifact = "http" | "request" | "response";
type SkillArtifact = "skill" | "script" | "example";

type AgentStep = {
  kind: "think" | "tool" | "answer";
  title: string;
  detail: string;
  call?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

const SECTIONS: Array<{ id: SectionId; label: string; cue: string }> = [
  { id: "api", label: "一次 API 调用", cue: "先让她自己点发送。动画结束后，不要先讲定义，让她点 HTTP / request.json / response.json，看真正传了什么。" },
  { id: "agent", label: "Agent 多了什么", cue: "重点看 tool_call 和 tool_result 的 JSON。问她：模型第二次决定下一步时，多知道了什么？" },
  { id: "skill", label: "Skill 具体长什么样", cue: "让她先读完整 SKILL.md，再切 scripts/inspect.py。不要把 Skill 说成一个按钮。" },
  { id: "github", label: "GitHub 下载以后", cue: "这里把下载落实成命令、目录和文件。顺便强调：拿到文件不等于 runtime 已经加载它。" },
  { id: "mcp", label: "MCP 到底传什么", cue: "直接看 tools/list 里返回的 tool schema，再看一次 tools/call。概念自然就出来了。" },
  { id: "modeling", label: "比赛里怎么拼", cue: "让她选一个阶段，然后看下面那条具体执行链。最后问：这一步哪个结果必须由她自己判断？" },
];

const AGENT_STEPS: AgentStep[] = [
  { kind: "think", title: "我得先看文件", detail: "光靠聊天内容，我不知道 CSV 里到底有什么。" },
  {
    kind: "tool",
    title: "read_file(\"data.csv\")",
    detail: "Agent 发出一个结构化 tool call；工具把真实文件信息再作为 tool result 返回。",
    call: { type: "tool_call", name: "read_file", arguments: { path: "data.csv" } },
    result: {
      type: "tool_result",
      name: "read_file",
      content: { rows: 428, columns: ["price", "area", "age", "distance", "rooms", "floor", "district"], missing: { age: 12, distance: 4 } },
    },
  },
  { kind: "think", title: "先把缺失和分布算清楚", detail: "现在它不是“猜数据长什么样”，而是根据刚才返回的 428 行、7 列继续决定。" },
  {
    kind: "tool",
    title: "run_python(\"inspect.py\")",
    detail: "第二次 tool call 把计算交给 Python；返回的是计算结果，不是模型自己编出来的数字。",
    call: { type: "tool_call", name: "run_python", arguments: { script: "inspect.py", args: ["data.csv"] } },
    result: {
      type: "tool_result",
      name: "run_python",
      content: { missing_rate: { age: 0.028, distance: 0.009 }, outliers: { area: 3 }, target_skew: 1.42 },
    },
  },
  { kind: "answer", title: "再回答你", detail: "最终结论可以明确引用：哪一列缺失、异常值在哪、下一步为什么这么做。" },
];

const MODELING_STAGES = [
  {
    title: "刚拿到题",
    ask: "先把题目变成一个能检查的建模问题。",
    agent: ["拆目标、变量、约束", "列出题目没有说清楚的条件", "给 2–3 条候选路线"],
    human: "你来决定题目到底在问什么，以及哪些假设能接受。",
    concrete: ["problem.pdf → read_file", "modeling-planning Skill → assumptions.md", "必要时 web_search → sources.md"],
  },
  {
    title: "开始找资料",
    ask: "把“搜到什么”和“为什么能用”分开。",
    agent: ["搜索定义、数据和已有方法", "把出处跟结论放在一起", "比较方法的适用条件"],
    human: "你判断来源靠不靠谱、这条资料是否真的适用于题目。",
    concrete: ["web_search(query) → 10 个候选来源", "read_page / read_pdf → evidence.json", "research Skill → sources.md + method-table.md"],
  },
  {
    title: "已经有数据",
    ask: "让工具真的去读、算、画，不要让模型凭描述猜。",
    agent: ["读文件和检查数据质量", "跑候选模型和敏感性分析", "保存脚本、参数和图表"],
    human: "你看结果是否合理，决定下一轮实验该改什么。",
    concrete: ["read_file(data.csv)", "run_python(inspect.py) → diagnostics.json", "run_python(baseline.py) → metrics.json + figures/"],
  },
  {
    title: "已经有模型",
    ask: "单独跑一个检查流程，而不是继续让原对话夸自己。",
    agent: ["检查单位和边界条件", "找数据泄漏或过拟合", "设计反例和验证实验"],
    human: "你决定哪些问题真的会影响结论，并最终对模型负责。",
    concrete: ["model.md + metrics.json → validation Skill", "run_python(stress_test.py)", "issues.md → severity / evidence / suggested fix"],
  },
  {
    title: "准备写论文",
    ask: "写作只能消费已经存在的真实结果。",
    agent: ["按已有证据整理结构", "把真实结果转成表格和文字", "检查数字、图、结论是否一致"],
    human: "你决定最终叙事，以及哪些结果值得放进论文。",
    concrete: ["results/ + figures/ + sources.md", "paper-writing Skill → outline.md", "draft.tex / draft.docx ← 只引用现有数字和图"],
  },
];

const API_HTTP = `POST /v1/responses HTTP/1.1
Host: api.example.ai
Authorization: Bearer sk-demo_••••••••
Content-Type: application/json`;

const MCP_TOOL_SCHEMA = `{
  "name": "get_issue",
  "description": "Read one GitHub issue",
  "inputSchema": {
    "type": "object",
    "properties": {
      "repo": { "type": "string" },
      "number": { "type": "integer" }
    },
    "required": ["repo", "number"]
  }
}`;

export default function Agent101Experience() {
  const [presenter, setPresenter] = useState(false);
  const [current, setCurrent] = useState<SectionId>("api");
  const [unlocked, setUnlocked] = useState(0);
  const [apiPrompt, setApiPrompt] = useState("帮我看看这份数据适不适合直接做线性回归。");
  const [apiPhase, setApiPhase] = useState(0);
  const [apiArtifact, setApiArtifact] = useState<ApiArtifact>("request");
  const [agentStep, setAgentStep] = useState(-1);
  const [unitRule, setUnitRule] = useState(false);
  const [skillRun, setSkillRun] = useState(0);
  const [skillArtifact, setSkillArtifact] = useState<SkillArtifact>("skill");
  const [downloaded, setDownloaded] = useState(false);
  const [githubStep, setGithubStep] = useState(0);
  const [mcpConnected, setMcpConnected] = useState(false);
  const [modelingStage, setModelingStage] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const nodes = SECTIONS.map((item) => root.querySelector<HTMLElement>(`#${item.id}`)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setCurrent(visible.target.id as SectionId);
    }, { rootMargin: "-24% 0px -58% 0px", threshold: [0.05, 0.25, 0.55] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [unlocked]);

  useEffect(() => {
    if (apiPhase <= 0 || apiPhase >= 5) return;
    const timer = window.setTimeout(() => setApiPhase((phase) => phase + 1), 650);
    return () => window.clearTimeout(timer);
  }, [apiPhase]);

  useEffect(() => {
    if (agentStep < 0 || agentStep >= AGENT_STEPS.length - 1) return;
    const timer = window.setTimeout(() => setAgentStep((step) => step + 1), 850);
    return () => window.clearTimeout(timer);
  }, [agentStep]);

  const currentMeta = SECTIONS.find((item) => item.id === current) ?? SECTIONS[0];

  const apiRequestJson = useMemo(() => JSON.stringify({
    model: "example-model",
    input: [{ role: "user", content: [{ type: "input_text", text: apiPrompt }] }],
  }, null, 2), [apiPrompt]);

  const apiResponseJson = useMemo(() => JSON.stringify({
    id: "resp_demo_001",
    status: "completed",
    model: "example-model",
    output: [{
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "先检查目标变量、缺失值、异常值、线性关系和残差，再决定是否直接做线性回归。" }],
    }],
    usage: { input_tokens: 26, output_tokens: 34 },
  }, null, 2), []);

  const fullSkillMd = useMemo(() => `---
name: modeling-helper
description: Inspect a tabular modeling task before fitting a model.
version: 0.1.0
---

# When to use
Use when the user has a modeling problem and tabular data that needs inspection.

# Inputs
- problem statement
- path to CSV / XLSX data

# Available tools
- read_file
- run_python
- web_search (only when a source lookup is needed)

# Workflow
1. Restate the objective and target variable.
2. List variables, constraints, and assumptions.${unitRule ? "\n3. Check that variable units are compatible." : ""}
${unitRule ? "4" : "3"}. Inspect columns, missing values, duplicates, ranges, and obvious outliers.
${unitRule ? "5" : "4"}. Run a simple baseline before proposing a more complex model.
${unitRule ? "6" : "5"}. Keep the evidence used for every conclusion.

# Output
Return:
- data issues
- assumptions to verify
- baseline findings
- candidate next steps
- evidence / file references

# Guardrails
- Do not invent experimental results.
- Separate observed evidence from suggestions.
- Do not hide missing data or failed calculations.`, [unitRule]);

  const skillScript = `from pathlib import Path
import pandas as pd


def inspect_data(path: str) -> dict:
    df = pd.read_csv(Path(path))
    return {
        "rows": len(df),
        "columns": list(df.columns),
        "missing": df.isna().sum().to_dict(),
        "duplicates": int(df.duplicated().sum()),
    }
`;

  const skillExample = `request: "检查 data.csv 后给我建模建议"
input_file: "data.csv"

expected_output:
  data_issues:
    - "age 有 12 个缺失值"
  assumptions_to_verify:
    - "目标变量与主要特征是否近似线性"
  next_steps:
    - "先跑一个可解释 baseline"

must_not:
  - "编造没有运行过的指标"
`;

  const skillSteps = useMemo(() => {
    const steps = ["读题并整理变量"];
    if (unitRule) steps.push("检查变量单位是否一致");
    steps.push("读取数据", "运行 baseline", "整理证据后回答");
    return steps;
  }, [unitRule]);

  function unlock(index: number) {
    setUnlocked((value) => Math.max(value, index));
    window.setTimeout(() => rootRef.current?.querySelector(`#${SECTIONS[index].id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function skillContent() {
    if (skillArtifact === "script") return skillScript;
    if (skillArtifact === "example") return skillExample;
    return fullSkillMd;
  }

  return (
    <div ref={rootRef} className={s.experience}>
      <header className={s.navbar}>
        <Link href="/presentation" className={s.brand}>Quark / Agent 101</Link>
        <div className={s.progress} aria-label="学习进度">
          {SECTIONS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              disabled={index > unlocked}
              className={current === item.id ? s.progressActive : undefined}
              onClick={() => rootRef.current?.querySelector(`#${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <span>{index + 1}</span>{item.label}
            </button>
          ))}
        </div>
        <button type="button" className={`${s.modeButton} ${presenter ? s.modeOn : ""}`} onClick={() => setPresenter((value) => !value)} aria-pressed={presenter}>
          {presenter ? "一起看 · 开" : "一起看"}
        </button>
      </header>

      {presenter && (
        <aside className={s.presenter} aria-live="polite">
          <b>这里可以停一下</b>
          <p>{currentMeta.cue}</p>
        </aside>
      )}

      <main>
        <section id="api" className={`${s.section} ${s.firstSection}`}>
          <div className={s.sectionIntro}>
            <p>先不背定义。先看一次请求真正传了什么。</p>
            <h1>你的小程序，怎么真的把一句话送到模型那里？</h1>
          </div>

          <div className={s.apiLab}>
            <div className={s.miniApp}>
              <div className={s.panelLabel}>你的小程序</div>
              <textarea value={apiPrompt} onChange={(event) => setApiPrompt(event.target.value)} aria-label="发送给模型的问题" />
              <button type="button" className={s.primary} disabled={!apiPrompt.trim() || (apiPhase > 0 && apiPhase < 5)} onClick={() => setApiPhase(1)}>
                {apiPhase > 0 && apiPhase < 5 ? "正在发送…" : apiPhase === 5 ? "再跑一次" : "发送"}
              </button>
            </div>

            <div className={s.requestStage} aria-live="polite">
              <div className={`${s.stageNode} ${apiPhase >= 1 ? s.stageActive : ""}`}>
                <small>PROGRAM</small><b>你的代码</b><span>把 prompt 组装成请求</span>
              </div>
              <div className={s.stageLink}><span className={apiPhase === 2 ? s.packet : ""}>REQUEST</span><i>→</i></div>
              <div className={`${s.stageNode} ${apiPhase >= 2 ? s.stageActive : ""}`}>
                <small>HTTP API</small><b>POST /v1/responses</b><span>header + JSON body</span>
              </div>
              <div className={s.stageLink}><span className={apiPhase === 3 ? s.packet : ""}>REQUEST</span><i>→</i></div>
              <div className={`${s.stageNode} ${apiPhase >= 3 ? s.stageActive : ""}`}>
                <small>MODEL SERVICE</small><b>example-model</b><span>处理 input，生成 output</span>
              </div>
            </div>

            {apiPhase >= 2 && (
              <div className={c.artifactPanel}>
                <div className={c.artifactHead}>
                  <div>
                    <b>这一趟线上真正有两部分：HTTP header + JSON body</b>
                    <span>下面是一个具体示例。不同供应商字段名可能不同，但“认证 + 结构化请求 + 结构化返回”这个关系一样。</span>
                  </div>
                  <div className={c.tabs}>
                    <button type="button" className={apiArtifact === "http" ? c.tabActive : ""} onClick={() => setApiArtifact("http")}>HTTP</button>
                    <button type="button" className={apiArtifact === "request" ? c.tabActive : ""} onClick={() => setApiArtifact("request")}>request.json</button>
                    <button type="button" className={apiArtifact === "response" ? c.tabActive : ""} onClick={() => setApiArtifact("response")}>response.json</button>
                  </div>
                </div>
                <pre className={c.codeBlock}>{apiArtifact === "http" ? API_HTTP : apiArtifact === "request" ? apiRequestJson : apiResponseJson}</pre>
                <div className={c.callouts}>
                  <span><b>Authorization</b>：API Key 通常放在认证信息里，不应该写进 prompt。</span>
                  <span><b>model</b>：告诉服务端你想调用哪个模型。</span>
                  <span><b>input</b>：这才是你真正想交给模型处理的内容。</span>
                  <span><b>output / usage</b>：返回不只有文字，也可以带状态、结构和用量信息。</span>
                </div>
              </div>
            )}

            <div className={`${s.returnPath} ${apiPhase >= 4 ? s.returnVisible : ""}`}>
              <span>模型生成 output</span><i>←</i><span>HTTP response</span><i>←</i><span>程序把 response 解析出来</span>
            </div>

            {apiPhase >= 5 && (
              <div className={s.meaningGrid}>
                <article><b>API</b><p>你刚才看到的 endpoint、headers、JSON 请求/返回规则，合起来就是程序与服务交互的接口。</p></article>
                <article><b>API Key</b><p>刚才它出现在 Authorization 里：用于认证调用者、权限和计费归属，而不是“给模型解锁智力”。</p></article>
                <article><b>模型</b><p>收到结构化 input 后，真正生成 output 的那部分服务。</p></article>
              </div>
            )}
          </div>

          {apiPhase >= 5 && <Continue onClick={() => unlock(1)}>好，为什么还需要 Agent？</Continue>}
        </section>

        {unlocked >= 1 && (
          <section id="agent" className={s.section}>
            <div className={s.sectionIntro}>
              <p>还是同一个问题，换成一个需要真实文件的任务。</p>
              <h2>“帮我看看 data.csv 有没有问题，然后给我结论。”</h2>
            </div>

            <div className={s.compareGrid}>
              <article className={s.chatPanel}>
                <div className={s.panelLabel}>普通聊天</div>
                <div className={s.userBubble}>帮我看看 data.csv 有没有问题。</div>
                <div className={s.aiBubble}>你可以先用 pandas 读取文件，检查缺失值、异常值和分布……</div>
                <div className={s.stopLine}>到这里就停了</div>
                <p>它可以告诉你“应该怎么做”，但当前这段对话里没有真的去打开文件。</p>
              </article>

              <article className={s.agentPanel}>
                <div className={s.panelRow}>
                  <div className={s.panelLabel}>Agent</div>
                  <button type="button" className={s.primary} onClick={() => setAgentStep(0)}>{agentStep >= 0 ? "重跑" : "让它真的做一次"}</button>
                </div>
                <div className={s.agentTimeline}>
                  {AGENT_STEPS.map((step, index) => (
                    <div key={step.title} className={`${s.agentEvent} ${index <= agentStep ? s.eventVisible : ""} ${s[`event_${step.kind}`]}`}>
                      <span>{index + 1}</span>
                      <div><b>{step.title}</b><p>{step.detail}</p></div>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            {agentStep >= 1 && (
              <div className={c.agentWire}>
                <div>
                  <div className={s.panelLabel}>当前真正发出的 tool call</div>
                  <pre className={c.codeBlock}>{JSON.stringify(AGENT_STEPS[Math.min(agentStep, 3)].call ?? { note: "这一阶段模型只是在决定下一步，没有调用工具。" }, null, 2)}</pre>
                </div>
                <div>
                  <div className={s.panelLabel}>工具真正返回给 Agent 的 result</div>
                  <pre className={c.codeBlock}>{JSON.stringify(AGENT_STEPS[Math.min(agentStep, 3)].result ?? { note: "没有 tool result。" }, null, 2)}</pre>
                </div>
              </div>
            )}

            {agentStep >= AGENT_STEPS.length - 1 && (
              <div className={s.takeaway}>
                <b>Agent 真正多出来的，不是一个“更厉害的大脑”。</b>
                <p>你刚才已经看到具体数据结构：模型先产生 <strong>tool_call</strong>，工具返回 <strong>tool_result</strong>，模型把这个新结果加入上下文，再决定下一步。这里的 <strong>read_file</strong> 和 <strong>run_python</strong> 才是 Tool。</p>
              </div>
            )}

            {agentStep >= AGENT_STEPS.length - 1 && <Continue onClick={() => unlock(2)}>那 Skill 到底具体长什么样？</Continue>}
          </section>
        )}

        {unlocked >= 2 && (
          <section id="skill" className={s.section}>
            <div className={s.sectionIntro}>
              <p>这次不只看“文件夹图标”，直接打开文件。</p>
              <h2>一个 Skill 可以是一组明确的说明、脚本和例子。</h2>
            </div>

            <div className={s.toolVsSkill}>
              <div className={s.toolShelf}>
                <div className={s.panelLabel}>TOOLS · 真正可调用的能力</div>
                <div className={s.toolCards}>
                  <span><b>read_file</b>读文件</span>
                  <span><b>run_python</b>运行代码</span>
                  <span><b>web_search</b>搜索网页</span>
                </div>
              </div>
              <div className={s.skillFolder}>
                <div className={s.panelLabel}>示例 SKILL · 一组可复用的任务规则</div>
                <div className={s.folderTree}>
                  <b>modeling-helper/</b>
                  <span>├── <strong>SKILL.md</strong></span>
                  <span>├── <strong>scripts/inspect.py</strong></span>
                  <span>└── <strong>examples/basic.yaml</strong></span>
                </div>
              </div>
            </div>

            <div className={c.skillWorkbench}>
              <div className={c.skillSidebar}>
                <button type="button" className={skillArtifact === "skill" ? c.fileActive : ""} onClick={() => setSkillArtifact("skill")}><b>SKILL.md</b><span>任务规则</span></button>
                <button type="button" className={skillArtifact === "script" ? c.fileActive : ""} onClick={() => setSkillArtifact("script")}><b>scripts/inspect.py</b><span>确定性代码</span></button>
                <button type="button" className={skillArtifact === "example" ? c.fileActive : ""} onClick={() => setSkillArtifact("example")}><b>examples/basic.yaml</b><span>预期输入输出</span></button>
              </div>
              <div className={c.skillFile}>
                <div className={c.fileMeta}>
                  <b>{skillArtifact === "skill" ? "SKILL.md" : skillArtifact === "script" ? "scripts/inspect.py" : "examples/basic.yaml"}</b>
                  <span>这是本页面采用的一个具体 Skill 示例，不代表所有 Agent/runtime 都使用完全相同的格式。</span>
                </div>
                <pre className={c.codeBlock}>{skillContent()}</pre>
              </div>
            </div>

            <div className={s.skillExperiment}>
              <div className={s.skillEditor}>
                <div className={s.panelLabel}>现在只改 SKILL.md 里的一个 workflow 规则</div>
                <label className={s.ruleToggle}>
                  <input type="checkbox" checked={unitRule} onChange={(event) => { setUnitRule(event.target.checked); setSkillArtifact("skill"); }} />
                  <span>增加：Check that variable units are compatible.</span>
                </label>
                <p className={c.smallExplain}>勾上后，完整 SKILL.md 的 Workflow 会真的多这一行；下面的 Agent 行为也跟着多一步。</p>
                <button type="button" className={s.primary} onClick={() => setSkillRun((value) => value + 1)}>按这个 Skill 跑一次</button>
              </div>

              <div className={s.behaviorPreview} key={`${skillRun}-${unitRule}`}>
                <div className={s.panelLabel}>Agent 这次实际走的步骤</div>
                <div className={s.behaviorSteps}>
                  {skillSteps.map((step, index) => <span key={`${step}-${skillRun}`} style={{ animationDelay: `${index * 120}ms` }}>{step}</span>)}
                </div>
                {skillRun > 0 && <p>你没有重新训练模型。你改的是：<strong>它处理这类任务时加载的一组规则和配套能力。</strong></p>}
              </div>
            </div>

            {skillRun > 0 && <Continue onClick={() => unlock(3)}>那 GitHub 上下载一个 Skill，到底下载了什么？</Continue>}
          </section>
        )}

        {unlocked >= 3 && (
          <section id="github" className={s.section}>
            <div className={s.sectionIntro}>
              <p>“下载一个 Skill”不是一句魔法命令，拆开就是普通文件操作。</p>
              <h2>先拿到 repo，再看里面到底有什么、能不能安全加载。</h2>
            </div>

            <div className={c.githubConcrete}>
              <div className={s.repoCard}>
                <div className={s.repoTop}><b>github.com/example/modeling-helper</b><span>示例仓库</span></div>
                <div className={s.repoFiles}><span>SKILL.md</span><span>scripts/inspect.py</span><span>examples/basic.yaml</span><span>README.md</span></div>
                <div className={c.commandLabel}>一种最普通的下载方式</div>
                <pre className={c.codeBlock}>git clone https://github.com/example/modeling-helper.git ~/skills/modeling-helper</pre>
                <button type="button" className={s.primary} onClick={() => { setDownloaded(true); setGithubStep(1); }}>模拟下载到本地</button>
              </div>

              <div className={`${s.localFolder} ${downloaded ? s.localVisible : ""}`}>
                <div className={s.panelLabel}>你的电脑</div>
                <pre className={c.treeBlock}>{`~/skills/modeling-helper/
├── SKILL.md
├── README.md
├── scripts/
│   └── inspect.py
└── examples/
    └── basic.yaml`}</pre>
              </div>
            </div>

            {downloaded && (
              <div className={s.compatibility}>
                <div className={s.compatibilitySteps}>
                  <button type="button" className={githubStep >= 1 ? s.compatActive : ""} onClick={() => setGithubStep(1)}><span>1</span><b>读 SKILL.md</b><small>它准备让 Agent 做什么？</small></button>
                  <button type="button" className={githubStep >= 2 ? s.compatActive : ""} onClick={() => setGithubStep(2)}><span>2</span><b>看 scripts/</b><small>会运行什么代码、读写什么路径？</small></button>
                  <button type="button" className={githubStep >= 3 ? s.compatActive : ""} onClick={() => setGithubStep(3)}><span>3</span><b>看 runtime 怎么加载</b><small>当前 Agent 是否识别这种目录/元数据？</small></button>
                </div>
                <div className={s.compatAnswer}>
                  {githubStep === 1 && <p>例如你刚才已经看到它要求先检查数据、跑 baseline、保存证据。这就是你真正要审的“行为说明”。</p>}
                  {githubStep === 2 && <p>这里的 <code>inspect.py</code> 会读取 CSV。真实仓库里如果还有 shell 命令、网络请求、写文件操作，也应该在执行前看清楚。</p>}
                  {githubStep >= 3 && <p><strong>拿到这些文件 ≠ 已经装好。</strong> 某个 runtime 可能要求固定目录、frontmatter、注册命令，甚至根本不支持这种 Skill 机制。</p>}
                </div>
              </div>
            )}

            {githubStep >= 3 && <Continue onClick={() => unlock(4)}>那 MCP 到底让 Agent 看到了什么？</Continue>}
          </section>
        )}

        {unlocked >= 4 && (
          <section id="mcp" className={s.section}>
            <div className={s.sectionIntro}>
              <p>不先讲“统一插座”。先看 Agent 接上一个 MCP server 后拿到的具体描述。</p>
              <h2>它先发现有哪些 tool，再按 schema 发起调用。</h2>
            </div>

            <div className={s.mcpLab}>
              <div className={s.mcpAgent}><small>AGENT</small><b>我现在想读 GitHub issue</b><span>先问 MCP server：你有哪些 tools？</span></div>
              <div className={`${s.mcpBridge} ${mcpConnected ? s.mcpBridgeOn : ""}`}><span>MCP</span><i>↔</i><small>tools/list · tools/call</small></div>
              <div className={`${s.mcpService} ${mcpConnected ? s.mcpServiceOn : ""}`}><small>MCP SERVER</small><b>GitHub tools</b><span>{mcpConnected ? "get_issue · search_repo · read_file" : "还没发现 tools"}</span></div>
              <button type="button" className={s.primary} onClick={() => setMcpConnected(true)} disabled={mcpConnected}>{mcpConnected ? "已经接上" : "连接 MCP server"}</button>
            </div>

            {mcpConnected && (
              <div className={c.mcpConcrete}>
                <div>
                  <div className={s.panelLabel}>tools/list 里一个 tool 的 schema</div>
                  <pre className={c.codeBlock}>{MCP_TOOL_SCHEMA}</pre>
                </div>
                <div>
                  <div className={s.panelLabel}>Agent 按这个 schema 发起 tools/call</div>
                  <pre className={c.codeBlock}>{`{
  "name": "get_issue",
  "arguments": {
    "repo": "example/modeling-project",
    "number": 12
  }
}`}</pre>
                  <div className={c.resultStrip}><b>tool result</b><span>{`{ "title": "Validate unit assumptions", "state": "open" }`}</span></div>
                </div>
              </div>
            )}

            {mcpConnected && (
              <div className={s.twoSentences}>
                <p><b>Skill：</b>例如刚才那份 SKILL.md，告诉 Agent 处理建模数据时按什么流程做。</p>
                <p><b>MCP：</b>例如这里的 <code>get_issue</code> schema，让 Agent 知道一个外部能力叫什么、要传哪些参数、能怎么调用。</p>
              </div>
            )}

            {mcpConnected && <Continue onClick={() => unlock(5)}>最后，把这些放进数学建模比赛</Continue>}
          </section>
        )}

        {unlocked >= 5 && (
          <section id="modeling" className={`${s.section} ${s.finalSection}`}>
            <div className={s.sectionIntro}>
              <p>现在别背概念，直接看一个阶段会落成哪些文件、tool call 和结果。</p>
              <h2>真正比赛时，你只需要问：我现在卡在哪一步？</h2>
            </div>

            <div className={s.stagePicker}>
              {MODELING_STAGES.map((stage, index) => (
                <button type="button" key={stage.title} className={modelingStage === index ? s.stageSelected : ""} onClick={() => setModelingStage(index)}>{stage.title}</button>
              ))}
            </div>

            <div className={s.modelingBoard}>
              <div className={s.modelingQuestion}>
                <span>你现在在：</span><b>{MODELING_STAGES[modelingStage].title}</b>
                <p>{MODELING_STAGES[modelingStage].ask}</p>
              </div>
              <div className={s.roleBoard}>
                <article>
                  <small>AGENT 可以帮你</small>
                  {MODELING_STAGES[modelingStage].agent.map((item) => <span key={item}>→ {item}</span>)}
                </article>
                <article>
                  <small>你必须自己负责</small>
                  <p>{MODELING_STAGES[modelingStage].human}</p>
                </article>
              </div>
            </div>

            <div className={c.concreteWorkflow}>
              <div className={s.panelLabel}>这一阶段实际可能长这样</div>
              {MODELING_STAGES[modelingStage].concrete.map((item, index) => (
                <div key={item}><span>{index + 1}</span><code>{item}</code>{index < MODELING_STAGES[modelingStage].concrete.length - 1 && <i>↓</i>}</div>
              ))}
            </div>

            <div className={s.finalMap}>
              <span><b>模型</b>生成下一步</span><i>→</i>
              <span><b>API</b>让代码能发送结构化请求</span><i>→</i>
              <span><b>Agent</b>产生 tool_call、读取 tool_result</span><i>→</i>
              <span><b>Skill</b>加载具体任务规则/脚本/例子</span><i>→</i>
              <span><b>MCP</b>把外部 tool schema 暴露给 Agent</span>
            </div>

            <div className={s.ending}>
              <b>真正要记住的不是比喻，而是这些 artefact。</b>
              <p>HTTP headers、request/response JSON、tool_call、tool_result、SKILL.md、scripts、tool schema——以后看到任何 Agent 产品，你都可以问：这些东西在它里面分别放哪儿？</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Continue({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={s.continueButton} onClick={onClick}>{children}<span>↓</span></button>;
}
