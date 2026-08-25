import type { Metadata } from "next";
import Link from "next/link";
import s from "./presentation.module.css";

export const metadata: Metadata = {
  title: "Presentation Lab — Quark Space",
  description: "用交互和可视化把复杂概念真正讲明白。",
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
        <h1>不是把字放大，是把关系讲清楚。</h1>
        <p className={s.lead}>
          用图、交互和真实例子解释一个概念到底在系统里做什么。可以自己看，也可以远程一起看。
        </p>
      </section>

      <section className={s.grid} aria-label="互动讲解">
        <Link href="/presentation/agent-101" className={s.card}>
          <div className={s.cardTop}>
            <span className={s.index}>01</span>
            <span className={s.status}>READY</span>
          </div>
          <div className={s.diagram} aria-hidden="true">
            <span>API</span><i>→</i><span>AGENT</span><i>→</i><span>SKILL</span><i>→</i><b>比赛</b>
          </div>
          <div>
            <p className={s.kicker}>AI AGENT × 数学建模</p>
            <h2>API Key、Agent、Skill 到底分别在干嘛？</h2>
            <p>从一次 API 请求开始，把 Agent、Tool、GitHub Skill、MCP 一路串起来，最后落到数学建模比赛里的实际用法。</p>
          </div>
          <div className={s.meta}>
            <span>零基础</span><span>交互可视化</span><span>可一起看</span>
          </div>
          <span className={s.open}>打开 →</span>
        </Link>
      </section>

      <footer className={s.footer}>
        <span>quarkspace.top/presentation</span>
        <Link href="/">返回主站 ↗</Link>
      </footer>
    </main>
  );
}
