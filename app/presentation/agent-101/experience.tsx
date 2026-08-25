"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./agent-101.module.css";

type SectionId = "intro" | "api" | "agent" | "skill" | "mcp" | "modeling";

type SkillFile = {
  id: string;
  label: string;
  title: string;
  explain: string;
  detail: string;
  code: string;
};

const SECTIONS: Array<{ id: SectionId; label: string; cue: string }> = [
  { id: "intro", label: "先串起来", cue: "先别讲术语。问她：API Key、Agent、Skill 这几个东西，她觉得分别是干嘛的？听完再往下。" },
  { id: "api", label: "API / Key", cue: "这里最重要。让她自己说一遍：API、API Key、模型、输入，各自在一次请求里负责什么。" },
  { id: "agent", label: "Agent", cue: "问她：普通聊天模型和 Agent 的差别，是模型变聪明了，还是多了一套执行机制？" },
  { id: "skill", label: "Skill", cue: "点几个文件给她看。重点是让她知道 Skill 不是一个神秘按钮，而是一组说明、代码和例子。" },
  { id: "mcp", label: "MCP", cue: "MCP 只需要讲清它和 Skill 不是一回事：一个更像连接协议，一个更像做事方法/能力包。" },
  { id: "modeling", label: "比赛里怎么用", cue: "最后别再背概念。拿她的比赛问：哪一步最想让 AI 帮忙？然后一起看这一步需要什么能力。" },
];

const AGENT_STEPS = [
  { title: "先看看文件", why: "它发现自己还不知道数据长什么样。", action: "read_file(data.csv)", result: "428 行，7 个变量，其中 2 列有缺失值" },
  { title: "再跑一段代码", why: "有了数据结构，下一步需要真正计算，而不是继续猜。", action: "run_python(analysis.py)", result: "得到分布、相关性、两组候选模型的验证结果" },
  { title: "根据结果继续", why: "它读到树模型波动更大，所以继续检查残差和敏感性。", action: "run_python(validation.py)", result: "发现一个边界条件下误差明显放大" },
  { title: "最后再回答", why: "答案现在来自刚才真实跑出来的结果。", action: "answer()", result: "给出结论，同时指出还需要人确认的假设" },
];

const SKILL_FILES: SkillFile[] = [
  {
    id: "skill",
    label: "SKILL.md",
    title: "告诉 Agent 什么时候用、怎么做",
    explain: "这是最像“说明书”的部分。它会写清楚：遇到什么任务时启用这个 Skill，按什么顺序做，以及哪些事情不要做。",
    detail: "不同 Agent 产品对 Skill 的格式不完全一样，所以 GitHub 上的 Skill 不是下载下来就一定能直接装。先看你正在用的 Agent 支持什么格式。",
    code: `# When to use\nWhen the user gives tabular data for a modeling task.\n\n# Steps\n1. Check columns and units\n2. Check missing values\n3. Run analysis\n4. Keep evidence for every conclusion`,
  },
  {
    id: "scripts",
    label: "scripts/",
    title: "把重复的事情交给代码真的跑",
    explain: "比如“读取 CSV、算统计量、画图”这种确定性的事情，与其每次让模型临时写，不如放成脚本。Agent 需要时直接调用。",
    detail: "这也是为什么 Skill 不只是 prompt。一个有用的 Skill 可以同时包含 instruction、scripts、templates、examples。",
    code: `def inspect_data(path):\n    df = pd.read_csv(path)\n    return {\n        "rows": len(df),\n        "missing": df.isna().sum(),\n        "summary": df.describe(),\n    }`,
  },
  {
    id: "examples",
    label: "examples/",
    title: "给它一个“应该怎么做”的例子",
    explain: "例子能让 Agent 更快知道什么样的输入对应什么样的输出，也能帮你检查以后改了 Skill 之后有没有跑偏。",
    detail: "专业一点，这既可以是 few-shot example，也可以进一步变成 regression fixture。",
    code: `input: data.csv\nrequest: 检查数据后给我建模建议\n\nexpected:\n- 先说数据问题\n- 再说候选模型\n- 明确假设\n- 不编造实验结果`,
  },
  {
    id: "readme",
    label: "README.md",
    title: "这是给人看的安装和风险说明",
    explain: "你从 GitHub 找到一个 Skill，先看这里和 SKILL.md，再决定要不要让它在自己电脑上执行。",
    detail: "特别留意它会读哪些文件、会不会联网、会运行什么命令，以及需要哪些密钥或权限。",
    code: `Requirements: Python 3.11+\nReads: selected local data files\nWrites: ./outputs only\nNetwork: none\n\nNever put an API key directly in source code.`,
  },
];

const WORKFLOW = [
  { title: "刚拿到题", human: "你来决定题目到底在问什么、哪些假设合理。", ai: "让 AI 帮你拆变量、列未知点、找你可能漏掉的条件。", caution: "不要一上来就让它直接给“完整模型”，那样最容易把错误假设一起吞下去。" },
  { title: "需要找资料", human: "你判断来源能不能信，以及这条资料是否真的适用于题目。", ai: "Agent 可以搜网页/论文，整理来源和已有方法，省掉大量机械搜索。", caution: "重要定义和数据必须保留来源，不能把模型自己记得的内容当引用。" },
  { title: "开始建模", human: "你选择最终假设、目标函数、约束和评价标准。", ai: "让它同时给 2–3 条候选路线，并解释每条路线的适用条件和代价。", caution: "不是选最复杂的模型，而是选最匹配问题、能验证、能解释的。" },
  { title: "跑代码和实验", human: "你看结果合不合理，决定下一轮要改什么。", ai: "Agent 调 Python、求解器和画图工具，批量跑参数、敏感性分析和对比实验。", caution: "把脚本、参数和结果留下来，否则最后论文里的数字没法追回去。" },
  { title: "写之前检查", human: "你对最终结论负责。", ai: "单独让一个检查流程找单位错误、边界条件、数据泄漏、过拟合和结论跳跃。", caution: "让“提出方案”和“挑方案毛病”分开，通常比一直让同一个对话自我肯定靠谱。" },
  { title: "最后写论文", human: "你决定论文讲什么故事、哪些结果最重要。", ai: "可以帮你整理结构、润色表达、把已经存在的实验结果变成表格和说明。", caution: "写作放在最后。先有真实模型和真实结果，再让 AI 帮你表达。" },
];

export default function Agent101Experience() {
  const [presenter, setPresenter] = useState(false);
  const [current, setCurrent] = useState<SectionId>("intro");
  const [apiPrompt, setApiPrompt] = useState("这份数据适合直接做线性回归吗？先告诉我应该检查什么。");
  const [apiSent, setApiSent] = useState(false);
  const [agentStep, setAgentStep] = useState(-1);
  const [selectedFile, setSelectedFile] = useState("skill");
  const [extraRule, setExtraRule] = useState("每次建模前，先检查变量的单位是否一致");
  const [workflowStep, setWorkflowStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const nodes = SECTIONS.map((item) => root.querySelector<HTMLElement>(`#${item.id}`)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setCurrent(visible.target.id as SectionId);
    }, { rootMargin: "-24% 0px -56% 0px", threshold: [0.05, 0.25, 0.55] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (agentStep < 0 || agentStep >= AGENT_STEPS.length - 1) return;
    const timer = window.setTimeout(() => setAgentStep((step) => step + 1), 1100);
    return () => window.clearTimeout(timer);
  }, [agentStep]);

  const currentMeta = SECTIONS.find((item) => item.id === current) ?? SECTIONS[0];
  const selected = SKILL_FILES.find((file) => file.id === selectedFile) ?? SKILL_FILES[0];
  const skillPreview = useMemo(() => `# Modeling helper\n\n## Steps\n1. Read the problem carefully\n2. ${extraRule.trim() || "检查变量和单位"}\n3. Run the required analysis\n4. Separate evidence from suggestions`, [extraRule]);

  function jumpTo(id: SectionId) {
    rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={rootRef} className={s.experience}>
      <header className={s.navbar}>
        <Link href="/presentation" className={s.brand}>Quark / AI Agent</Link>
        <nav className={s.progress} aria-label="页面章节">
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" onClick={() => jumpTo(item.id)} className={current === item.id ? s.progressActive : undefined}>
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className={`${s.modeButton} ${presenter ? s.modeOn : ""}`} onClick={() => setPresenter((value) => !value)} aria-pressed={presenter}>
          {presenter ? "一起看：开" : "一起看"}
        </button>
      </header>

      {presenter && (
        <aside className={s.presenter} aria-live="polite">
          <b>你可以在这里停一下：</b>
          <p>{currentMeta.cue}</p>
        </aside>
      )}

      <main>
        <section id="intro" className={`${s.section} ${s.intro}`}>
          <div className={s.introText}>
            <p className={s.opening}>你之前问我 API Key、怎么接模型、Skill 是什么、GitHub 上能不能下载 Skill。</p>
            <h1>其实这些不是四件分开的事。<br />把这一条线看懂就行。</h1>
            <p className={s.lead}>我不想让你背定义。下面每一段都只回答一个问题：<b>这个东西在整条链路里到底负责什么？</b></p>
            <div className={s.questionList}>
              <button type="button" onClick={() => jumpTo("api")}>API Key 到底是干嘛的？</button>
              <button type="button" onClick={() => jumpTo("agent")}>Agent 比聊天 AI 多了什么？</button>
              <button type="button" onClick={() => jumpTo("skill")}>Skill 为什么可以从 GitHub 下载？</button>
              <button type="button" onClick={() => jumpTo("modeling")}>比赛里到底什么时候值得用？</button>
            </div>
          </div>

          <div className={s.bigPicture} aria-label="AI 应用、API、模型、工具之间的关系">
            <FlowNode top="你在用的 App" main="聊天界面 / 代码" sub="你输入问题的地方" />
            <FlowArrow text="通过 API 发请求" />
            <FlowNode top="模型服务" main="LLM" sub="真正生成下一步内容" strong />
            <FlowArrow text="需要时调用工具" />
            <FlowNode top="外部能力" main="文件 · Python · 网页" sub="让它不只是说，而是真的做" />
          </div>
        </section>

        <section id="api" className={s.section}>
          <SectionTitle question="先把最容易混的说清楚" title="API、API Key、模型，分别是什么？" />

          <div className={s.conceptGrid}>
            <ConceptCard word="API" simple="一套“怎么把请求送进去、怎么把结果拿回来”的规则。" example="像一个服务窗口：程序知道去哪里、按什么格式交材料。" />
            <ConceptCard word="API Key" simple="证明这次调用属于哪个账号，也决定权限和费用记到谁那里。" example="更像门禁卡，不是模型本身，也不会让模型变聪明。" />
            <ConceptCard word="Model" simple="你真正想调用的模型，例如某个 GPT、Claude、Qwen。" example="同一个 API 平台里可能同时有很多不同模型。" />
            <ConceptCard word="Input" simple="你发给模型的内容，包括问题、上下文，有时还有图片或工具结果。" example="模型只会根据它这次真正收到的东西继续生成。" />
          </div>

          <div className={s.apiStory}>
            <div className={s.apiComposer}>
              <p className={s.panelTitle}>你现在模拟发一次请求</p>
              <label htmlFor="apiPrompt">输入</label>
              <textarea id="apiPrompt" value={apiPrompt} onChange={(event) => { setApiPrompt(event.target.value); setApiSent(false); }} rows={4} />
              <div className={s.requestFields}>
                <span><b>模型</b><em>gpt-example</em></span>
                <span><b>API Key</b><em>sk-••••••</em></span>
                <span><b>地址</b><em>/v1/responses</em></span>
              </div>
              <button type="button" className={s.primary} onClick={() => setApiSent(true)} disabled={!apiPrompt.trim()}>发送这次请求</button>
            </div>

            <div className={`${s.requestPath} ${apiSent ? s.requestPathActive : ""}`}>
              <span>你的程序</span><i>→</i><span>API</span><i>→</i><span>模型</span><i>→</i><span>返回结果</span>
            </div>

            <div className={s.apiMeaning}>
              <p className={s.panelTitle}>这一刻真正发生的是</p>
              <ol>
                <li><b>程序</b>把“模型是谁、你说了什么、你的 Key”打包成请求。</li>
                <li><b>服务端</b>先用 Key 确认权限和计费，再把输入交给指定模型。</li>
                <li><b>模型</b>生成输出，API 再把结果按固定格式返回给程序。</li>
              </ol>
              <div className={s.keyWarning}>所以 API Key 要放在环境变量或服务端配置里，<b>不要写进 GitHub 仓库。</b></div>
            </div>
          </div>

          {apiSent && <div className={s.responseBox}><span>模型返回：</span><p>“可以先检查变量之间是否近似线性、残差是否有结构、异常值是否主导拟合，以及训练/验证划分是否独立。检查完再决定线性回归是不是合理。”</p></div>}
        </section>

        <section id="agent" className={s.section}>
          <SectionTitle question="然后就到了 Agent" title="为什么有的 AI 只告诉你怎么做，有的会自己继续做？" />
          <div className={s.agentDifference}>
            <div className={s.chatOnly}>
              <p className={s.panelTitle}>普通聊天</p>
              <div className={s.chatBubble}>“你可以读取 CSV，然后做相关性分析，再画残差图。”</div>
              <p>它给了你一个方法，但到这里就结束了。</p>
            </div>
            <div className={s.agentLoopVisual}>
              <p className={s.panelTitle}>Agent 多出来的是这一圈</p>
              <div className={s.loopCircle}>
                <span>看现在的信息</span><i>→</i><span>决定下一步</span><i>→</i><span>调用工具</span><i>→</i><span>读工具结果</span>
              </div>
              <p>只要任务还没完成，它就可以根据新结果继续下一轮。</p>
            </div>
          </div>

          <div className={s.agentDemo}>
            <div className={s.demoTop}>
              <div><b>例如你说：</b><p>“帮我分析 data.csv，比较两个模型，然后告诉我哪个更稳。”</p></div>
              <button type="button" className={s.primary} onClick={() => setAgentStep(0)}>{agentStep >= 0 && agentStep < AGENT_STEPS.length - 1 ? "正在往下做…" : "看它怎么做"}</button>
            </div>
            <div className={s.agentSteps}>
              {AGENT_STEPS.map((step, index) => (
                <article key={step.title} className={index <= agentStep ? s.stepVisible : undefined}>
                  <span>{index + 1}</span>
                  <div><h3>{step.title}</h3><p>{step.why}</p><code>{step.action}</code><small>{step.result}</small></div>
                </article>
              ))}
            </div>
          </div>
          <p className={s.coreSentence}><b>所以 Agent 不是另一种神奇模型。</b>它通常还是 LLM，只是外面多了一套“可以看状态、选工具、拿结果、继续”的执行循环。</p>
        </section>

        <section id="skill" className={s.section}>
          <SectionTitle question="那 Skill 又是什么？" title="它更像给 Agent 准备好的一套做事方法。" />
          <p className={s.sectionLead}>比如你不想每次都从头告诉 Agent“先检查数据、再跑统计、最后别乱编结果”。你可以把这套固定方法整理成一个 Skill，让它以后遇到类似任务直接复用。</p>

          <div className={s.skillAnatomy}>
            <div className={s.skillFiles}>
              <p>一个 Skill 仓库里可能长这样：</p>
              {SKILL_FILES.map((file) => <button key={file.id} type="button" className={selectedFile === file.id ? s.fileActive : undefined} onClick={() => setSelectedFile(file.id)}><span>{file.label}</span><i>→</i></button>)}
            </div>
            <div className={s.skillExplain}>
              <h3>{selected.title}</h3>
              <p>{selected.explain}</p>
              <p className={s.skillDetail}>{selected.detail}</p>
              <pre><code>{selected.code}</code></pre>
            </div>
          </div>

          <div className={s.githubFlow}>
            <h3>所以，“GitHub 上的 Skill 能不能下载下来用？”</h3>
            <p><b>可以下载，但“下载”不等于“已经能用”。</b>正确顺序更像这样：</p>
            <div className={s.githubSteps}><span>找到仓库</span><i>→</i><span>看 SKILL.md / README</span><i>→</i><span>检查脚本和权限</span><i>→</i><span>确认你的 Agent 支持这种格式</span><i>→</i><span>再安装或放进对应目录</span></div>
          </div>

          <div className={s.editSkill}>
            <div>
              <h3>自己改 Skill，其实经常就是改这种规则</h3>
              <p>比如你希望它以后每次做数学建模之前，都先检查单位。你不需要“训练一个新 AI”，只需要把这条要求放进它会读的 Skill 说明里。</p>
              <label htmlFor="extraRule">试着改这一条</label>
              <input id="extraRule" value={extraRule} onChange={(event) => setExtraRule(event.target.value)} />
            </div>
            <pre><code>{skillPreview}</code></pre>
          </div>
        </section>

        <section id="mcp" className={s.section}>
          <SectionTitle question="MCP 放在哪里？" title="它和 Skill 解决的不是同一个问题。" />
          <div className={s.mcpCompare}>
            <article><span>Skill</span><h3>告诉 Agent “这件事怎么做”</h3><p>更偏方法、说明、脚本、模板和例子。它把一项能力整理成可以复用的形式。</p></article>
            <article><span>MCP</span><h3>告诉 AI 应用 “外面的能力怎么接进来”</h3><p>Model Context Protocol 是一种标准接口。一个 AI 应用可以通过它发现并调用文件、GitHub、数据库等外部能力。</p></article>
          </div>
          <div className={s.mcpLine}><span>Agent</span><i>需要读 GitHub</i><span>MCP</span><i>按统一接口连接</i><span>GitHub 工具</span></div>
          <p className={s.coreSentence}>第一轮只要记住这点就够了：<b>Skill 更像“会怎么做”，MCP 更像“怎么连到能做这件事的外部能力”。</b></p>
        </section>

        <section id="modeling" className={`${s.section} ${s.modeling}`}>
          <SectionTitle question="最后回到你真正要用的地方" title="数学建模比赛里，不是“让 AI 替你做题”，而是把它放在合适的步骤。" />
          <div className={s.workflowTabs}>
            {WORKFLOW.map((step, index) => <button key={step.title} type="button" onClick={() => setWorkflowStep(index)} className={workflowStep === index ? s.workflowActive : undefined}><span>{index + 1}</span>{step.title}</button>)}
          </div>
          <div className={s.workflowDetail}>
            <h3>{WORKFLOW[workflowStep].title}</h3>
            <div className={s.roles}>
              <article><span>你来做</span><p>{WORKFLOW[workflowStep].human}</p></article>
              <article><span>AI 可以帮</span><p>{WORKFLOW[workflowStep].ai}</p></article>
            </div>
            <div className={s.caution}><b>这里最容易踩的坑：</b>{WORKFLOW[workflowStep].caution}</div>
          </div>

          <div className={s.finalMap}>
            <p>现在再看这些词，它们其实已经连起来了：</p>
            <div><span>你有一个任务</span><i>→</i><span>程序通过 API 调模型</span><i>→</i><span>Agent 决定下一步</span><i>→</i><span>用 Tool / MCP 接外部能力</span><i>→</i><span>Skill 告诉它这类任务怎么做</span></div>
          </div>
          <div className={s.endNote}><p>如果你看完以后能自己解释一句：</p><strong>“API Key 是身份凭证；Agent 是会根据工具结果继续行动的模型执行循环；Skill 是可复用的做事方法。”</strong><p>那其实就已经够你开始用了。</p></div>
        </section>
      </main>
    </div>
  );
}

function SectionTitle({ question, title }: { question: string; title: string }) {
  return <header className={s.sectionTitle}><p>{question}</p><h2>{title}</h2></header>;
}

function ConceptCard({ word, simple, example }: { word: string; simple: string; example: string }) {
  return <article className={s.conceptCard}><h3>{word}</h3><p>{simple}</p><span>{example}</span></article>;
}

function FlowNode({ top, main, sub, strong = false }: { top: string; main: string; sub: string; strong?: boolean }) {
  return <div className={`${s.flowNode} ${strong ? s.flowNodeStrong : ""}`}><small>{top}</small><b>{main}</b><span>{sub}</span></div>;
}

function FlowArrow({ text }: { text: string }) {
  return <div className={s.flowArrow}><span>{text}</span><i>→</i></div>;
}
