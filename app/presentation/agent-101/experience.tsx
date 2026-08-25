"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./agent-101.module.css";

type SectionId = "api" | "agent" | "skill" | "github" | "mcp" | "modeling";

const SECTIONS: Array<{ id: SectionId; label: string; cue: string }> = [
  { id: "api", label: "一次 API 调用", cue: "先让她自己点发送。等动画跑完再问：Key 在哪？API 又在哪？" },
  { id: "agent", label: "Agent 多了什么", cue: "重点看同一个任务：普通聊天只能告诉你怎么做，Agent 会真的调用工具再继续。" },
  { id: "skill", label: "Skill 怎么影响行为", cue: "先跑一遍，再勾上“先检查单位”重跑。让她自己说出变化发生在哪里。" },
  { id: "github", label: "GitHub 下载以后", cue: "这里纠正一个误区：能下载，不等于当前 Agent 一定能直接装。" },
  { id: "mcp", label: "MCP 放在哪", cue: "一句话就够：Skill 主要说怎么做，MCP 主要解决怎么接外部能力。" },
  { id: "modeling", label: "比赛里怎么拼", cue: "最后别考术语。让她选一个自己最可能卡住的阶段，再看 Agent 能帮到哪。" },
];

const AGENT_STEPS = [
  { kind: "think", title: "我得先看文件", detail: "光靠聊天内容，我不知道 CSV 里到底有什么。" },
  { kind: "tool", title: "read_file(\"data.csv\")", detail: "工具返回：有 7 个变量，其中 2 列有缺失。" },
  { kind: "think", title: "先把缺失和分布算清楚", detail: "现在有了真实观察，再决定下一步。" },
  { kind: "tool", title: "run_python(\"inspect.py\")", detail: "工具返回：缺失比例、分布和异常值摘要。" },
  { kind: "answer", title: "再回答你", detail: "结论引用刚才实际拿到的结果，而不是凭空猜。" },
];

const MODELING_STAGES = [
  {
    title: "刚拿到题",
    ask: "先别急着让 AI 给完整答案。",
    agent: ["把目标、变量、约束拆出来", "列出题目里没有说清楚的地方", "给 2–3 条可能的建模路线"],
    human: "你来决定题目到底在问什么，以及哪些假设能接受。",
  },
  {
    title: "开始找资料",
    ask: "让 Agent 帮你搜，但别把“它说过”当成来源。",
    agent: ["搜索定义、数据和已有方法", "把出处跟结论放在一起", "整理哪些方法适用于你的条件"],
    human: "你判断来源靠不靠谱、这条资料是否真的适用于题目。",
  },
  {
    title: "已经有数据",
    ask: "这时候 Agent 最好用：让工具真的去读、算、画。",
    agent: ["读文件和检查数据质量", "跑候选模型和敏感性分析", "保存脚本、参数和图表"],
    human: "你看结果是否合理，决定下一轮实验该改什么。",
  },
  {
    title: "已经有模型",
    ask: "不要只让它夸你的方案，让它专门找漏洞。",
    agent: ["检查单位和边界条件", "找可能的数据泄漏或过拟合", "设计反例和验证实验"],
    human: "你决定哪些问题真的会影响结论，并最终对模型负责。",
  },
  {
    title: "准备写论文",
    ask: "最后才把表达交给 AI。",
    agent: ["按已有证据整理结构", "把真实结果转成表格和文字", "检查数字、图、结论能不能互相对应"],
    human: "你决定最终叙事，以及哪些结果值得放进论文。",
  },
];

export default function Agent101Experience() {
  const [presenter, setPresenter] = useState(false);
  const [current, setCurrent] = useState<SectionId>("api");
  const [unlocked, setUnlocked] = useState(0);
  const [apiPrompt, setApiPrompt] = useState("帮我看看这份数据适不适合直接做线性回归。");
  const [apiPhase, setApiPhase] = useState(0);
  const [agentStep, setAgentStep] = useState(-1);
  const [unitRule, setUnitRule] = useState(false);
  const [skillRun, setSkillRun] = useState(0);
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
  const skillSteps = useMemo(() => {
    const steps = ["读题并整理变量"];
    if (unitRule) steps.push("检查变量单位是否一致");
    steps.push("读取数据", "运行分析", "整理证据后回答");
    return steps;
  }, [unitRule]);

  function unlock(index: number) {
    setUnlocked((value) => Math.max(value, index));
    window.setTimeout(() => rootRef.current?.querySelector(`#${SECTIONS[index].id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
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
            <p>先不背定义。你只看一次请求怎么跑。</p>
            <h1>假设你做了一个小程序，想让它问 AI 一个问题。</h1>
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
                <small>PROGRAM</small><b>你的代码</b><span>准备一个请求</span>
              </div>
              <div className={s.stageLink}>
                <span className={apiPhase === 2 ? s.packet : ""}>REQUEST</span>
                <i>→</i>
              </div>
              <div className={`${s.stageNode} ${apiPhase >= 2 ? s.stageActive : ""}`}>
                <small>API</small><b>/v1/responses</b><span>规定请求怎么进、结果怎么回</span>
              </div>
              <div className={s.stageLink}>
                <span className={apiPhase === 3 ? s.packet : ""}>REQUEST</span>
                <i>→</i>
              </div>
              <div className={`${s.stageNode} ${apiPhase >= 3 ? s.stageActive : ""}`}>
                <small>MODEL SERVICE</small><b>模型</b><span>处理输入并生成结果</span>
              </div>
            </div>

            <div className={`${s.requestCard} ${apiPhase >= 2 ? s.requestVisible : ""}`}>
              <div><span>model</span><code>example-model</code></div>
              <div><span>input</span><code>{apiPrompt || "…"}</code></div>
              <div className={s.keyRow}><span>Authorization</span><code>Bearer ••••••••</code><b>← API Key 在这里</b></div>
            </div>

            <div className={`${s.returnPath} ${apiPhase >= 4 ? s.returnVisible : ""}`}>
              <span>模型返回结果</span><i>←</i><span>API response</span><i>←</i><span>你的程序显示出来</span>
            </div>

            {apiPhase >= 5 && (
              <div className={s.meaningGrid}>
                <article><b>API</b><p>不是模型。它是一套接口规则：程序去哪里请求、按什么格式发、结果怎么回来。</p></article>
                <article><b>API Key</b><p>不是“让 AI 变聪明”的东西。它主要用来认证这是谁的调用、有什么权限、费用记到哪里。</p></article>
                <article><b>模型</b><p>真正处理输入、生成下一段内容的那部分。</p></article>
              </div>
            )}
          </div>

          {apiPhase >= 5 && <Continue onClick={() => unlock(1)}>好，为什么还需要 Agent？</Continue>}
        </section>

        {unlocked >= 1 && (
          <section id="agent" className={s.section}>
            <div className={s.sectionIntro}>
              <p>还是同一个问题，换一个任务。</p>
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

            {agentStep >= AGENT_STEPS.length - 1 && (
              <div className={s.takeaway}>
                <b>Agent 真正多出来的，不是一个“更厉害的大脑”。</b>
                <p>关键是这一层执行循环：模型决定下一步 → 调工具 → 读工具结果 → 再决定下一步，直到任务结束。这里的 <strong>read_file</strong> 和 <strong>run_python</strong> 才是 Tool。</p>
              </div>
            )}

            {agentStep >= AGENT_STEPS.length - 1 && <Continue onClick={() => unlock(2)}>那 Skill 又是什么？</Continue>}
          </section>
        )}

        {unlocked >= 2 && (
          <section id="skill" className={s.section}>
            <div className={s.sectionIntro}>
              <p>先分清 Tool 和 Skill。</p>
              <h2>Tool 是“能做什么”；Skill 更像“做这类事时，应该怎么做”。</h2>
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
                <div className={s.panelLabel}>SKILL · 一套可复用的做事方法</div>
                <div className={s.folderTree}>
                  <b>modeling-helper/</b>
                  <span>├── <strong>SKILL.md</strong>　什么时候用、按什么顺序做</span>
                  <span>├── <strong>scripts/</strong>　配套的确定性脚本</span>
                  <span>└── <strong>examples/</strong>　输入输出示例</span>
                </div>
              </div>
            </div>

            <div className={s.skillExperiment}>
              <div className={s.skillEditor}>
                <div className={s.panelLabel}>现在只改一条规则</div>
                <label className={s.ruleToggle}>
                  <input type="checkbox" checked={unitRule} onChange={(event) => setUnitRule(event.target.checked)} />
                  <span>每次建模前，先检查变量单位是否一致</span>
                </label>
                <pre>{`# SKILL.md\n\n1. 读题并整理变量\n${unitRule ? "2. 检查变量单位是否一致\n" : ""}${unitRule ? "3" : "2"}. 读取数据\n${unitRule ? "4" : "3"}. 运行分析\n${unitRule ? "5" : "4"}. 整理证据后回答`}</pre>
                <button type="button" className={s.primary} onClick={() => setSkillRun((value) => value + 1)}>按这个 Skill 跑一次</button>
              </div>

              <div className={s.behaviorPreview} key={`${skillRun}-${unitRule}`}>
                <div className={s.panelLabel}>Agent 这次实际走的步骤</div>
                <div className={s.behaviorSteps}>
                  {skillSteps.map((step, index) => <span key={`${step}-${skillRun}`} style={{ animationDelay: `${index * 120}ms` }}>{step}</span>)}
                </div>
                {skillRun > 0 && <p>你没有重新训练模型。你改的是：<strong>它做这类任务时遵循的流程。</strong></p>}
              </div>
            </div>

            {skillRun > 0 && <Continue onClick={() => unlock(3)}>那 GitHub 上下载一个 Skill，到底下载了什么？</Continue>}
          </section>
        )}

        {unlocked >= 3 && (
          <section id="github" className={s.section}>
            <div className={s.sectionIntro}>
              <p>这一步很容易被说得太神秘。</p>
              <h2>从 GitHub 下载 Skill，本质上就是把这组文件拿到自己这边。</h2>
            </div>

            <div className={s.githubFlow}>
              <div className={s.repoCard}>
                <div className={s.repoTop}><b>github.com/example/modeling-helper</b><span>public repo</span></div>
                <div className={s.repoFiles}><span>SKILL.md</span><span>scripts/</span><span>examples/</span><span>README.md</span></div>
                <button type="button" className={s.primary} onClick={() => { setDownloaded(true); setGithubStep(1); }}>下载到本地</button>
              </div>

              <div className={`${s.localFolder} ${downloaded ? s.localVisible : ""}`}>
                <div className={s.panelLabel}>你的电脑</div>
                <b>~/skills/modeling-helper/</b>
                <span>文件已经在这里了。</span>
              </div>
            </div>

            {downloaded && (
              <div className={s.compatibility}>
                <div className={s.compatibilitySteps}>
                  <button type="button" className={githubStep >= 1 ? s.compatActive : ""} onClick={() => setGithubStep(1)}><span>1</span><b>先读说明</b><small>README / SKILL.md 写了什么？</small></button>
                  <button type="button" className={githubStep >= 2 ? s.compatActive : ""} onClick={() => setGithubStep(2)}><span>2</span><b>再看安全</b><small>会运行什么脚本、读什么文件、要什么权限？</small></button>
                  <button type="button" className={githubStep >= 3 ? s.compatActive : ""} onClick={() => setGithubStep(3)}><span>3</span><b>最后看兼容性</b><small>你正在用的 Agent/runtime 认不认识这种 Skill 格式？</small></button>
                </div>
                <div className={s.compatAnswer}>
                  {githubStep === 1 && <p>先看它到底想教 Agent 做什么，不要看到 “Skill” 两个字就直接运行。</p>}
                  {githubStep === 2 && <p>Skill 可能包含脚本和命令。下载代码本身没问题，<strong>执行之前</strong>才需要认真检查权限和密钥。</p>}
                  {githubStep >= 3 && <p><strong>最关键：</strong>“能从 GitHub 下载” ≠ “下载下来一定能直接装”。不同 Agent 产品支持的 Skill 结构和加载方式可能不同。</p>}
                </div>
              </div>
            )}

            {githubStep >= 3 && <Continue onClick={() => unlock(4)}>那 MCP 跟这些东西是什么关系？</Continue>}
          </section>
        )}

        {unlocked >= 4 && (
          <section id="mcp" className={s.section}>
            <div className={s.sectionIntro}>
              <p>MCP 不需要现在学一堆协议细节。</p>
              <h2>只要先看懂：它解决的是“外部能力怎么接进来”。</h2>
            </div>

            <div className={s.mcpLab}>
              <div className={s.mcpAgent}><small>AGENT</small><b>我现在想读 GitHub issue</b><span>但我需要一个我能调用的接口。</span></div>
              <div className={`${s.mcpBridge} ${mcpConnected ? s.mcpBridgeOn : ""}`}><span>MCP</span><i>↔</i><small>统一描述可用的 tools / resources</small></div>
              <div className={`${s.mcpService} ${mcpConnected ? s.mcpServiceOn : ""}`}><small>EXTERNAL SERVICE</small><b>GitHub</b><span>{mcpConnected ? "get_issue · search_repo · read_file" : "还没接进来"}</span></div>
              <button type="button" className={s.primary} onClick={() => setMcpConnected(true)} disabled={mcpConnected}>{mcpConnected ? "已经接上" : "接入 GitHub"}</button>
            </div>

            {mcpConnected && (
              <div className={s.twoSentences}>
                <p><b>Skill：</b>做这类任务时，建议按什么方法和流程做。</p>
                <p><b>MCP：</b>Agent 用什么标准方式发现和调用外部工具 / 数据。</p>
              </div>
            )}

            {mcpConnected && <Continue onClick={() => unlock(5)}>最后，把这些放进数学建模比赛</Continue>}
          </section>
        )}

        {unlocked >= 5 && (
          <section id="modeling" className={`${s.section} ${s.finalSection}`}>
            <div className={s.sectionIntro}>
              <p>现在不用再背 API、Agent、Skill、MCP。</p>
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

            <div className={s.finalMap}>
              <span><b>模型</b>生成下一步</span><i>→</i>
              <span><b>API</b>让程序能调用模型</span><i>→</i>
              <span><b>Agent</b>循环调用 Tool 去做事</span><i>→</i>
              <span><b>Skill</b>让一类任务有稳定做法</span><i>→</i>
              <span><b>MCP</b>把外部能力接进来</span>
            </div>

            <div className={s.ending}>
              <b>你不需要把这些东西都“学会了”才开始比赛。</b>
              <p>只要能看懂它们分别在哪一层、什么时候有用，就已经足够开始搭自己的工作流。后面遇到一个真实需求，再补那一块。</p>
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
