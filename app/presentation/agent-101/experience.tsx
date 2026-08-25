"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./agent-101.module.css";

type SectionId = "intro" | "api" | "agent" | "skill" | "build" | "mcp" | "modeling";

type SkillFile = {
  id: string;
  label: string;
  icon: string;
  title: string;
  plain: string;
  pro: string;
  code: string;
};

const SECTIONS: Array<{ id: SectionId; no: string; label: string; cue: string }> = [
  { id: "intro", no: "00", label: "先拆开 ChatGPT", cue: "先问她：你觉得 ChatGPT 网页和模型本身是一回事吗？别急着给答案。" },
  { id: "api", no: "01", label: "第一次调用 API", cue: "让她先猜一次请求需要什么。等她说完，再点发送。" },
  { id: "agent", no: "02", label: "模型长出手脚", cue: "重点不是“AI 会思考”，而是它会根据结果继续选择下一步工具。" },
  { id: "skill", no: "03", label: "Skill 到底是什么", cue: "让她自己点 SKILL.md 和 scripts。问：哪个更像说明书，哪个真的在执行？" },
  { id: "build", no: "04", label: "亲手做一个 Skill", cue: "这一步尽量让她自己输入。目标是让她产生“原来我也能写”的感觉。" },
  { id: "mcp", no: "05", label: "MCP 放在哪一层", cue: "只讲标准接口，不展开 JSON-RPC、transport。她理解连接关系就够了。" },
  { id: "modeling", no: "06", label: "把它带进比赛", cue: "最后问她：真实比赛里，你最想先把哪一步交给 Agent？答案比背术语重要。" },
];

const AGENT_STEPS = [
  { tag: "PLAN", title: "先看数据", detail: "需要知道 CSV 里有哪些列、缺失值和目标变量。", tool: "read_file(\"data.csv\")" },
  { tag: "OBSERVE", title: "拿到 428 行", detail: "发现 7 个特征，其中 2 列存在缺失值。", tool: "result → 428 rows · 7 features" },
  { tag: "ACT", title: "跑分析", detail: "先看相关性和分布，再决定是否需要更复杂的模型。", tool: "run_python(\"analysis.py\")" },
  { tag: "OBSERVE", title: "比较候选模型", detail: "线性模型更稳，树模型拟合更高但验证波动更大。", tool: "result → metrics + residuals" },
  { tag: "ACT", title: "把结果画出来", detail: "把最关键的误差与敏感性结果变成可放进论文的图。", tool: "create_chart(\"residuals\")" },
  { tag: "ANSWER", title: "给出结论 + 证据", detail: "最终回答引用真实计算结果，并明确哪些判断仍需要人来确认。", tool: "final response" },
];

const SKILL_FILES: SkillFile[] = [
  {
    id: "skill",
    icon: "◇",
    label: "SKILL.md",
    title: "给 Agent 的岗位说明书",
    plain: "告诉 Agent：什么时候该用这个能力、该怎么做、什么情况下别乱做。",
    pro: "Skill 的 instruction layer：定义触发条件、流程、约束、输入输出契约。",
    code: `---\nname: data-analysis\ndescription: Analyze tabular data for modeling tasks\n---\n\n# When to use\nUse when the user provides CSV / XLSX data.\n\n# Workflow\n1. Inspect schema\n2. Check missing values\n3. Run bounded analysis\n4. Return evidence + caveats`,
  },
  {
    id: "scripts",
    icon: "⌘",
    label: "scripts/analyze.py",
    title: "真正干活的脚本",
    plain: "说明书说“分析数据”，脚本负责把读取、统计和画图真正执行出来。",
    pro: "Executable implementation：把可重复、确定性的步骤从语言模型里下沉成代码。",
    code: `import pandas as pd\n\ndef analyze(path: str):\n    df = pd.read_csv(path)\n    return {\n        "rows": len(df),\n        "missing": df.isna().sum().to_dict(),\n        "summary": df.describe().to_dict(),\n    }`,
  },
  {
    id: "examples",
    icon: "▦",
    label: "examples/",
    title: "给它看一个标准答案",
    plain: "例子不是装饰。它让 Agent 更容易知道输入长什么样、结果应该长什么样。",
    pro: "Few-shot examples / fixtures：既能教学，也能成为回归测试的种子。",
    code: `input: sales.csv\nrequest: \"检查数据质量并给出建模建议\"\n\nexpected:\n- schema summary\n- missing-value report\n- candidate models\n- assumptions to verify`,
  },
  {
    id: "readme",
    icon: "i",
    label: "README.md",
    title: "给人看的入口",
    plain: "告诉人类怎么安装、需要什么环境、有哪些风险和限制。",
    pro: "Human-facing documentation：安装、依赖、权限、版本和 provenance 应该在这里说清楚。",
    code: `# Data Analysis Skill\n\nRequirements: Python 3.11+\nPermissions: local file read only\n\nBefore running a GitHub skill:\n- read SKILL.md\n- inspect scripts / commands\n- check required permissions\n- never commit API keys`,
  },
];

const WORKFLOW = [
  { no: "01", title: "读题", short: "Problem framing", detail: "把目标、约束、变量、评价标准拆开。AI 可以帮你提问，但问题定义由你拍板。" },
  { no: "02", title: "找资料", short: "Research", detail: "搜索定义、已有方法和数据来源；每个关键事实保留出处，不要把模型记忆当文献。" },
  { no: "03", title: "提模型", short: "Model design", detail: "让 Agent 给候选建模路径和适用条件，再由你选假设最合理、可解释、可验证的一条。" },
  { no: "04", title: "跑实验", short: "Code + solve", detail: "把数据清洗、求解、敏感性分析交给工具执行；保留脚本和参数，结果才可复现。" },
  { no: "05", title: "查漏洞", short: "Validation", detail: "检查单位、边界条件、数据泄漏、过拟合和反例。最好让“生成答案”和“挑错”分开。" },
  { no: "06", title: "写论文", short: "Evidence → story", detail: "最后才让 AI 帮你组织论文。图表、数字和结论都应该能追回前面的真实实验。" },
];

function safeSkillName(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "model-reviewer";
}

export default function Agent101Experience() {
  const [presenter, setPresenter] = useState(false);
  const [current, setCurrent] = useState<SectionId>("intro");
  const [showPro, setShowPro] = useState(false);
  const [apiPrompt, setApiPrompt] = useState("帮我判断这个数学模型可能有哪些问题，并告诉我应该检查什么。\n");
  const [apiSent, setApiSent] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState("skill");
  const [skillName, setSkillName] = useState("model-reviewer");
  const [skillTrigger, setSkillTrigger] = useState("当已经有一个数学模型，需要检查假设、变量和验证方法时");
  const [skillGoal, setSkillGoal] = useState("检查模型假设、变量、单位、边界条件和验证方法，并给出修改建议");
  const [workflowStep, setWorkflowStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const nodes = SECTIONS.map((item) => root.querySelector<HTMLElement>(`#${item.id}`)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setCurrent(visible.target.id as SectionId);
    }, { rootMargin: "-22% 0px -58% 0px", threshold: [0.05, 0.25, 0.55] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!agentRunning || agentStep >= AGENT_STEPS.length - 1) return;
    const timer = window.setTimeout(() => setAgentStep((step) => step + 1), 900);
    return () => window.clearTimeout(timer);
  }, [agentRunning, agentStep]);

  const currentMeta = SECTIONS.find((item) => item.id === current) ?? SECTIONS[0];
  const selected = SKILL_FILES.find((file) => file.id === selectedFile) ?? SKILL_FILES[0];
  const generatedSkill = useMemo(() => {
    const name = safeSkillName(skillName);
    return `---\nname: ${name}\ndescription: Review mathematical models and surface weaknesses\n---\n\n# When to use\n${skillTrigger.trim() || "When a mathematical model needs review."}\n\n# Goal\n${skillGoal.trim() || "Review assumptions and validation."}\n\n# Workflow\n1. Restate the model and its objective\n2. Check assumptions, variables, units and constraints\n3. Search for boundary cases and contradictory evidence\n4. Check the validation plan\n5. Return issues by severity with concrete fixes\n\n# Output\n- issue\n- severity\n- why it matters\n- suggested fix\n\n# Guardrails\nDo not invent experimental results. Separate observed evidence from suggestions.`;
  }, [skillGoal, skillName, skillTrigger]);

  function runAgent() {
    setAgentStep(0);
    setAgentRunning(true);
  }

  function jumpTo(id: SectionId) {
    rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={rootRef} className={s.experience}>
      <header className={s.navbar}>
        <Link href="/presentation" className={s.brand}>Q / PRESENTATION</Link>
        <div className={s.progress} aria-label="学习进度">
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" className={current === item.id ? s.progressActive : undefined} onClick={() => jumpTo(item.id)} aria-label={`跳到 ${item.label}`}>
              <span>{item.no}</span>
            </button>
          ))}
        </div>
        <button type="button" className={`${s.modeButton} ${presenter ? s.modeOn : ""}`} onClick={() => setPresenter((value) => !value)} aria-pressed={presenter}>
          {presenter ? "一起学习 · ON" : "一起学习"}
        </button>
      </header>

      {presenter && (
        <aside className={s.presenter} aria-live="polite">
          <div><span className={s.presenterBadge}>PRESENTER</span><b>{currentMeta.no} · {currentMeta.label}</b></div>
          <p>{currentMeta.cue}</p>
        </aside>
      )}

      <main>
        <section id="intro" className={`${s.section} ${s.hero}`}>
          <div className={s.heroCopy}>
            <p className={s.eyebrow}>AI AGENT × 数学建模 / 00</p>
            <h1>你已经会用 AI 了。<br /><span>现在把它拆开。</span></h1>
            <p className={s.heroLead}>目标不是背一晚上术语，而是从“会聊天”走到：会接模型、会让它调用工具、会装和改 Skill，最后知道比赛里哪一步该交给 Agent。</p>
            <div className={s.heroActions}>
              <button type="button" className={s.primary} onClick={() => { setPresenter(false); jumpTo("api"); }}>自己探索</button>
              <button type="button" className={s.secondary} onClick={() => { setPresenter(true); jumpTo("api"); }}>腾讯会议一起学</button>
            </div>
            <div className={s.termLine}><span>保留专业词</span><b>API · Tool Calling · Agent · Skill · MCP</b><span>但先说人话</span></div>
          </div>

          <div className={s.exploded} aria-label="聊天应用与模型的关系">
            <div className={s.chatCard}>
              <span className={s.windowDots}>● ● ●</span>
              <div className={s.bubble}>帮我分析这份数据，可以吗？</div>
              <div className={`${s.bubble} ${s.aiBubble}`}>当然。我先看看数据结构……</div>
            </div>
            <div className={s.connector}><span>你平时看到的 App</span><i>↓ API</i></div>
            <div className={s.modelCore}><small>MODEL</small><strong>LLM</strong><span>真正生成下一段内容的模型</span></div>
            <p className={s.aha}><b>Aha：</b> ChatGPT / Claude 是产品；模型是其中一个核心部件。</p>
          </div>
        </section>

        <section id="api" className={s.section}>
          <SectionHead no="01" kicker="API LAB" title="第一次让程序调用模型" lead="先别写 Python。先看一次请求到底经过了什么。" />
          <div className={s.apiLab}>
            <div className={s.apiInput}>
              <label htmlFor="api-prompt">你要对模型说什么？</label>
              <textarea id="api-prompt" value={apiPrompt} onChange={(event) => { setApiPrompt(event.target.value); setApiSent(false); }} rows={5} />
              <div className={s.apiFields}>
                <span><small>MODEL</small><b>gpt-example</b></span>
                <span><small>API KEY</small><b>sk-••••••••</b></span>
                <span><small>ENDPOINT</small><b>/v1/responses</b></span>
              </div>
              <button type="button" className={s.primary} onClick={() => setApiSent(true)} disabled={!apiPrompt.trim()}>发送给模型 →</button>
            </div>

            <div className={`${s.packetTrack} ${apiSent ? s.packetSent : ""}`} aria-hidden="true">
              <span className={s.packet}>JSON</span><i>→</i>
            </div>

            <div className={`${s.apiOutput} ${apiSent ? s.apiOutputReady : ""}`} aria-live="polite">
              <small>MODEL RESPONSE</small>
              {apiSent ? (
                <>
                  <strong>我会先检查 4 件事：</strong>
                  <ol><li>假设是否与真实场景冲突</li><li>变量和单位是否定义完整</li><li>边界条件是否覆盖极端情况</li><li>验证集是否真的独立</li></ol>
                </>
              ) : <p>点击发送后，这里会出现模拟响应。整个页面不会真的把内容发到外部模型。</p>}
            </div>
          </div>
          <PlainAndPro showPro={showPro} onToggle={() => setShowPro((value) => !value)} plain="API 就像窗口：你的程序把请求交给模型服务，再把结果拿回来。API Key 用来证明“这次调用算谁的”。" pro="API client 向 endpoint 发送 authenticated request。请求体通常包含 model、input/messages 和参数；服务返回 structured response。Key 属于 credential，绝对不要提交到 GitHub。" />
          <div className={s.codeStrip}>
            <span>然后代码才有意义</span>
            <code>{`client.responses.create({ model: "...", input: "..." })`}</code>
          </div>
        </section>

        <section id="agent" className={`${s.section} ${s.darkSection}`}>
          <SectionHead no="02" kicker="AGENT LOOP" title="模型什么时候变成 Agent？" lead="不是因为它写得更像人，而是因为它可以选择工具、读取结果，再决定下一步。" dark />
          <div className={s.agentCompare}>
            <article><small>普通聊天模型</small><div className={s.brain}>LLM</div><p>“你可以用 Python 读取 CSV，然后画残差图。”</p><span>告诉你怎么做</span></article>
            <article className={s.agentCard}><small>Agent</small><div className={s.agentTools}><b>LLM</b><i>→</i><span>📄 read_file</span><span>⌘ run_python</span><span>▦ create_chart</span></div><p>自己选择工具 → 看结果 → 再继续。</p><span>真的把步骤执行掉</span></article>
          </div>

          <div className={s.loopLab}>
            <div className={s.loopHeader}><div><small>LIVE SIMULATION</small><b>“分析 CSV，比较模型，然后画图。”</b></div><button type="button" className={s.lightButton} onClick={runAgent}>{agentRunning && agentStep < AGENT_STEPS.length - 1 ? "运行中…" : "重新运行 Agent"}</button></div>
            <div className={s.timeline}>
              {AGENT_STEPS.map((step, index) => (
                <div key={`${step.tag}-${index}`} className={`${s.timelineStep} ${index <= agentStep ? s.stepVisible : ""} ${index === agentStep ? s.stepCurrent : ""}`}>
                  <span className={s.stepNo}>{String(index + 1).padStart(2, "0")}</span>
                  <div><small>{step.tag}</small><b>{step.title}</b><p>{step.detail}</p><code>{step.tool}</code></div>
                </div>
              ))}
            </div>
          </div>
          <PlainAndPro showPro={showPro} onToggle={() => setShowPro((value) => !value)} plain="普通模型主要生成文字；Agent 多了一层执行循环：看现在发生了什么 → 选一个工具 → 拿回结果 → 再决定。" pro="典型 agent loop 包含 state/observation、policy/model decision、tool invocation、tool result 和 termination condition。Tool Calling 是机制，Agent 是把这种机制放进连续控制循环。" dark />
        </section>

        <section id="skill" className={s.section}>
          <SectionHead no="03" kicker="SKILL ANATOMY" title="Skill 没那么玄乎：拆开看。" lead="可以把它理解成“可复用的 Agent 能力包”。真正重要的是：说明、代码、例子和边界。" />
          <div className={s.skillLab}>
            <div className={s.fileTree} role="list" aria-label="Skill 文件">
              <div className={s.folderTitle}>📦 data-analysis-skill</div>
              {SKILL_FILES.map((file) => (
                <button key={file.id} type="button" role="listitem" onClick={() => setSelectedFile(file.id)} className={selectedFile === file.id ? s.fileActive : undefined}>
                  <span>{file.icon}</span><b>{file.label}</b><i>→</i>
                </button>
              ))}
            </div>
            <div className={s.fileDetail}>
              <div><span className={s.fileTag}>{selected.label}</span><h3>{selected.title}</h3></div>
              <p className={s.bigPlain}>{selected.plain}</p>
              <p className={s.proText}><b>专业一点：</b>{selected.pro}</p>
              <pre><code>{selected.code}</code></pre>
            </div>
          </div>

          <div className={s.githubSafety}>
            <div><span>GitHub 上能下载 Skill 吗？</span><strong>能。但别无脑运行。</strong></div>
            <ol><li><b>1</b>先读 SKILL.md</li><li><b>2</b>检查 scripts / commands</li><li><b>3</b>看需要哪些权限</li><li><b>4</b>确认没有把 Key 写进代码</li></ol>
            <div className={s.keyCompare}><code className={s.bad}>API_KEY = &quot;sk-xxxxx&quot;</code><span>✕</span><code>.env → OPENAI_API_KEY=…</code><span>✓</span></div>
          </div>
        </section>

        <section id="build" className={`${s.section} ${s.buildSection}`}>
          <SectionHead no="04" kicker="BUILD A SKILL" title="现在，亲手造一个“数学建模检查员”。" lead="不用先学框架。先把一个能力说清楚：什么时候触发、做什么、输出什么、哪些事不准瞎编。" />
          <div className={s.builder}>
            <form onSubmit={(event) => event.preventDefault()} className={s.builderForm}>
              <label>Skill 名字<input value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="model-reviewer" /></label>
              <label>什么时候使用？<textarea value={skillTrigger} onChange={(event) => setSkillTrigger(event.target.value)} rows={4} /></label>
              <label>它要完成什么？<textarea value={skillGoal} onChange={(event) => setSkillGoal(event.target.value)} rows={4} /></label>
              <div className={s.builderHint}><span>你正在定义</span><b>trigger → workflow → output → guardrails</b></div>
            </form>
            <div className={s.generated}>
              <div className={s.generatedHead}><span>GENERATED</span><b>📦 {safeSkillName(skillName)}/SKILL.md</b></div>
              <pre><code>{generatedSkill}</code></pre>
            </div>
          </div>
          <div className={s.ahaWide}><span>这就是关键的心理门槛：</span><strong>Skill 不是“神秘插件”。你完全可以读、改、自己写。</strong></div>
        </section>

        <section id="mcp" className={s.section}>
          <SectionHead no="05" kicker="MCP" title="那 Agent 怎么连接一堆外部能力？" lead="等 Tool、Agent、Skill 都理解以后，再看 MCP 就简单多了：它解决的是“怎么用统一方式把能力接进来”。" />
          <div className={s.mcpDiagram}>
            <div className={s.mcpAgent}><small>YOUR APP</small><b>Agent</b><span>决定现在需要什么</span></div>
            <div className={s.mcpPipe}><span>MCP</span><i>Model Context Protocol</i></div>
            <div className={s.mcpTools}><span>📁 Files</span><span>⌘ GitHub</span><span>🗃 Database</span><span>🌐 Browser</span></div>
          </div>
          <PlainAndPro showPro={showPro} onToggle={() => setShowPro((value) => !value)} plain="可以先把 MCP 想成“统一插座”：AI 应用用同一种约定去发现和调用外部工具。" pro="MCP 是连接 AI application 与 external context/tools 的开放协议层。这里先理解能力发现与调用关系；transport、JSON-RPC 等实现细节不影响第一轮使用。" />
        </section>

        <section id="modeling" className={`${s.section} ${s.finalSection}`}>
          <SectionHead no="06" kicker="MODELING LAB" title="最后一关：比赛里到底怎么用？" lead="不要做“一键国奖 Agent”。把比赛拆成可验证的工作流，人负责判断，Agent 负责加速。" />
          <div className={s.workflow}>
            <div className={s.workflowRail}>
              {WORKFLOW.map((step, index) => (
                <button key={step.no} type="button" onClick={() => setWorkflowStep(index)} className={workflowStep === index ? s.workflowActive : undefined}>
                  <span>{step.no}</span><div><b>{step.title}</b><small>{step.short}</small></div>
                </button>
              ))}
            </div>
            <div className={s.workflowDetail}>
              <span className={s.workflowNo}>{WORKFLOW[workflowStep].no}</span>
              <p className={s.workflowKicker}>{WORKFLOW[workflowStep].short}</p>
              <h3>{WORKFLOW[workflowStep].title}</h3>
              <p>{WORKFLOW[workflowStep].detail}</p>
              <div className={s.humanAgent}><span><small>YOU</small><b>判断问题有没有意义</b><i>定义 · 取舍 · 验证 · 最终负责</i></span><span><small>AGENT</small><b>把重复工作跑起来</b><i>搜索 · 代码 · 实验 · 整理 · 检查</i></span></div>
            </div>
          </div>

          <div className={s.finish}>
            <p>现在你已经能把这些词放回正确位置：</p>
            <div className={s.termMap}><span>MODEL</span><i>→</i><span>API</span><i>→</i><span>TOOL</span><i>→</i><span>AGENT</span><i>→</i><span>SKILL</span><i>→</i><span>MCP</span></div>
            <h2>真正重要的不是记住它们。<br />是知道下一次该让哪一层帮你。</h2>
            <div className={s.finishActions}><button type="button" className={s.primary} onClick={() => jumpTo("api")}>再走一遍重点</button><Link className={s.secondaryLink} href="/presentation">回到 Presentation Lab</Link></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionHead({ no, kicker, title, lead, dark = false }: { no: string; kicker: string; title: string; lead: string; dark?: boolean }) {
  return (
    <div className={`${s.sectionHead} ${dark ? s.sectionHeadDark : ""}`}>
      <div><span>{no}</span><p>{kicker}</p></div>
      <h2>{title}</h2>
      <p>{lead}</p>
    </div>
  );
}

function PlainAndPro({ showPro, onToggle, plain, pro, dark = false }: { showPro: boolean; onToggle: () => void; plain: string; pro: string; dark?: boolean }) {
  return (
    <div className={`${s.explain} ${dark ? s.explainDark : ""}`}>
      <div><small>先这么理解</small><p>{plain}</p></div>
      <button type="button" onClick={onToggle} aria-expanded={showPro}>{showPro ? "收起专业解释 ↑" : "专业一点 ↓"}</button>
      {showPro && <div className={s.proBox}><small>PRO VIEW</small><p>{pro}</p></div>}
    </div>
  );
}
