import type { Metadata } from "next";
import Link from "next/link";
import s from "./presentation.module.css";

export const metadata: Metadata = {
  title: "Presentation Lab — Quark Space",
  description: "可分享、可演示、可复习的互动讲解。",
};

export default function PresentationHub() {
  return (
    <main className={s.hub}>
      <header className={s.topbar}>
        <Link href="/" className={s.brand}>Q / QUARK SPACE</Link>
        <span className={s.mono}>PRESENTATION LAB</span>
      </header>

      <section className={s.hero}>
        <p className={s.eyebrow}>INTERACTIVE EXPLAINERS</p>
        <h1>把复杂的东西，讲到真的会用。</h1>
        <p className={s.lead}>
          这里不是幻灯片仓库。每个主题都可以自己点、自己试，也可以在远程会议里开启讲解模式一起走一遍。
        </p>
      </section>

      <section className={s.grid} aria-label="互动展示">
        <Link href="/presentation/agent-101" className={s.card}>
          <div className={s.cardTop}>
            <span className={s.index}>01</span>
            <span className={s.status}>READY</span>
          </div>
          <div className={s.diagram} aria-hidden="true">
            <span>MODEL</span><i>→</i><span>API</span><i>→</i><span>TOOL</span><i>→</i><b>AGENT</b>
          </div>
          <div>
            <p className={s.kicker}>AI AGENT × 数学建模</p>
            <h2>从“会聊天”到“会让 AI 干活”</h2>
            <p>API Key、Tool Calling、Agent、Skill、GitHub、MCP，再把它们拼成一套数学建模比赛工作流。</p>
          </div>
          <div className={s.meta}>
            <span>零基础</span><span>45–60 min</span><span>Presenter Mode</span>
          </div>
          <span className={s.open}>开始体验 →</span>
        </Link>
      </section>

      <footer className={s.footer}>
        <span>quarkspace.top/presentation</span>
        <Link href="/">返回主站 ↗</Link>
      </footer>
    </main>
  );
}
