import Image from "next/image";
import Link from "next/link";
import s from "./home.module.css";
import {
  closing,
  costBars,
  experience,
  featured,
  others,
  profile,
  skills,
  type Featured,
  type Meter,
} from "./home-content";

// The personal site. The observatory moved to /models when this became the root route —
// see app/models/layout.tsx for the title that used to live in the root layout.
//
// Every style lives in home.module.css under .home. Nothing here may reach into
// globals.css: that file owns the observatory's phone contract (docs/UI.md).

const SHOT_W = 1700;
const SHOT_H = 1099;
const EMAIL = "mailto:jimmyenglish@126.com";
const RESUME_CN = "/resume/Jiaming_Wei_CV_EVAL_CN_v1.0.pdf";
const RESUME_EN = "/resume/Jiaming_Wei_CV_EVAL_EN_v1.0.pdf";

function MeterRow({ m }: { m: Meter }) {
  const fill = m.tone === "w" ? s.fW : m.tone === "n" ? s.fN : s.fA;
  return (
    <div className={s.meter}>
      <div className={s.meterRow}>
        <span>{m.label}</span>
        <b>{m.value}</b>
      </div>
      {m.pct > 0 && (
        <div className={s.track}>
          <i className={fill} style={{ width: `${m.pct}%`, opacity: m.faint ? 0.55 : 1 }} />
        </div>
      )}
    </div>
  );
}

function CostChart({ cap }: { cap?: string }) {
  return (
    <div>
      <div className={s.costwrap}>
        <p className={s.lbl} style={{ marginBottom: 14 }}>
          六种观测模式的账单成本 / episode
        </p>
        <div className={s.yax}>
          <span>$0.08</span>
          <span>classifieds 站点</span>
        </div>
        <div className={s.cost}>
          {costBars.heights.map((h, i) => (
            <i key={i} className={i === costBars.hi ? s.hi : undefined} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className={s.costlbl}>
          <span>$0.064 — $0.073</span>
          <span>六种模式几乎持平</span>
        </div>
      </div>
      {cap && <p className={s.cap}>{cap}</p>}
    </div>
  );
}

function Ring({ pct, meters }: { pct: number; meters?: Meter[] }) {
  const r = 29;
  const c = 2 * Math.PI * r;
  return (
    <div className={s.ringRow}>
      <svg className={s.ring} width="82" height="82" viewBox="0 0 82 82" role="img"
        aria-label={`格覆盖率 ${pct}%`}>
        <circle cx="41" cy="41" r={r} fill="none" stroke="#eae6db" strokeWidth="10" />
        <circle cx="41" cy="41" r={r} fill="none" stroke="#c9a63a" strokeWidth="10"
          strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 41 41)" />
        <text x="41" y="46" textAnchor="middle">{pct}%</text>
      </svg>
      <div>{meters?.map((m) => <MeterRow key={m.label} m={m} />)}</div>
    </div>
  );
}

function Body({ p }: { p: Featured }) {
  return (
    <>
      <span className={s.lbl}>{p.kicker}</span>
      <h2 className={`${s.h2} ${p.bigTitle ? s.h2big : ""}`} style={{ marginTop: 14 }}>
        {p.title}
      </h2>
      <div className={s.who}>
        {p.who.map((w) => (
          <span key={w.text} className={w.todo ? s.todo : undefined}>{w.text}</span>
        ))}
      </div>
      {p.shot && (
        <>
          <span className={s.shot}>
            <Image src={p.shot.src} alt={p.shot.alt} width={SHOT_W} height={SHOT_H} sizes="(max-width: 900px) 100vw, 50vw" />
          </span>
          <p className={s.cap}>{p.shot.cap}</p>
        </>
      )}
      {p.pull && <p className={s.pull}>{p.pull}</p>}
      <p className={s.lead} style={{ marginTop: p.shot || p.pull ? 14 : 0 }}>{p.lead}</p>
      {p.chart === "ring" && <Ring pct={p.ringPct ?? 0} meters={p.meters} />}
      {p.metersLabel && !p.wide && (
        <p className={s.lbl} style={{ margin: "20px 0 4px" }}>{p.metersLabel}</p>
      )}
      {!p.wide && p.chart !== "ring" && p.meters?.map((m) => <MeterRow key={m.label} m={m} />)}
      {p.points && (
        <ul className={s.points}>
          {p.points.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
      <p className={s.stack}>{p.stack}</p>
      <span className={s.go}>{p.goLabel ?? "GitHub →"}</span>
    </>
  );
}

function Card({ p }: { p: Featured }) {
  const inner = p.wide ? (
    <div className={s.banner}>
      <div><Body p={p} /></div>
      <div>
        {p.chart === "cost" && <CostChart cap={p.cap} />}
        {p.meters && p.chart !== "cost" && (
          <>
            {p.metersLabel && <p className={s.lbl} style={{ marginBottom: 12 }}>{p.metersLabel}</p>}
            {p.meters.map((m) => <MeterRow key={m.label} m={m} />)}
            {p.cap && <p className={s.cap}>{p.cap}</p>}
          </>
        )}
      </div>
    </div>
  ) : (
    <Body p={p} />
  );

  const cls = `${s.t} ${s[p.span]}`;
  return p.href.startsWith("/") ? (
    <Link className={cls} href={p.href}>{inner}</Link>
  ) : (
    <a className={cls} href={p.href}>{inner}</a>
  );
}

function Section({ no, title, count, id }: { no: string; title: string; count: string; id?: string }) {
  return (
    <div className={s.c12} id={id}>
      <div className={s.sec}>
        <span className={s.no}>{no}</span>
        <h2 className={s.secTitle}>{title}</h2>
        <span className={s.rule} />
        <span className={s.cnt}>{count}</span>
      </div>
    </div>
  );
}

function MeasurementChain() {
  const steps = [
    {
      no: "01",
      title: "Target / Agent",
      body: "模型真正做了什么？任务成功了？拒答了？还是已经越过了边界？",
      foot: "behavior · task success",
    },
    {
      no: "02",
      title: "Execution / Harness",
      body: "这个结果真的是模型造成的吗？还是 observation、tool、provider filter、scaffold 或执行环境改变了它？",
      foot: "trajectory · environment",
    },
    {
      no: "03",
      title: "Judge / Grader",
      body: "负责打分的工具自己靠谱吗？rubric、阈值、shortcut、FP/FN，会不会直接把结论改写？",
      foot: "FP / FN · calibration",
    },
    {
      no: "04",
      title: "Gold / Evidence",
      body: "最后这个结论靠什么兜底？能不能回到独立标签、统计检验、来源和可重放证据？",
      foot: "labels · provenance",
    },
  ];

  return (
    <div className={`${s.t} ${s.c12}`} aria-label="Evaluation measurement chain">
      <span className={s.lbl}>同一条方法论 / measurement chain</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
        <h2 className={s.h2} style={{ margin: 0 }}>一个分数出来之前，我先检查这四层</h2>
        <span className={s.stack} style={{ margin: 0 }}>model → system → judge → evidence</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
        {steps.map((step, i) => (
          <div
            key={step.no}
            style={{
              flex: "1 1 190px",
              minWidth: 0,
              border: "1px solid #e6e2d6",
              borderRadius: 7,
              padding: "16px 16px 14px",
              background: i === steps.length - 1 ? "#fbf4e0" : "#fdfcf8",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, fontWeight: 700, color: "#7a6318" }}>{step.no}</span>
              {i < steps.length - 1 && <span aria-hidden="true" style={{ color: "#c9a63a", fontSize: 18 }}>→</span>}
            </div>
            <h3 style={{ margin: "12px 0 7px", fontSize: 16, lineHeight: 1.2, letterSpacing: "-0.02em", color: "#15161a" }}>{step.title}</h3>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.58 }}>{step.body}</p>
            <p style={{ margin: "12px 0 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8a887f" }}>{step.foot}</p>
          </div>
        ))}
      </div>
      <p className={s.cap} style={{ marginTop: 14 }}>
        P79、Holistic、redteam-under-test、FinQA 和 Model Observatory 看起来不像同一个项目。但我其实一直在问同一件事：这个结果到底意味着什么？产生它的测量链到底能不能信？
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <div className={s.home}>
      <div className={s.bar}>
        <div className={s.barIn}>
          <span className={s.me}>{profile.name}</span>
          <nav className={s.nav}>
            {profile.nav.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
            <Link className={s.sub} href="/persona">Persona Lab ↗</Link>
            <Link className={s.sub} href="/models">观测台 ↗</Link>
          </nav>
          <a className={s.cv} href={RESUME_CN}>简历 PDF</a>
        </div>
      </div>

      <div className={s.wrap}>
        <div className={s.g}>
          <div className={`${s.t} ${s.c8}`}>
            <span className={s.avail}><i />{profile.availability}</span>
            <h1 className={s.h1}>{profile.name}</h1>
            <p className={s.role}>{profile.role}</p>
            <p className={s.say}>{profile.claim[0]}<br />{profile.claim[1]}</p>
            <p className={s.lead}>{profile.intro}</p>
            <div className={s.cta}>
              <a className={`${s.btn} ${s.pri}`} href={RESUME_CN}>中文简历 PDF</a>
              <a className={s.btn} href={RESUME_EN}>English CV</a>
              <a className={s.btn} href="#work">看研究与系统</a>
              <a className={s.btn} href={profile.github}>GitHub</a>
              <a className={s.btn} href={EMAIL}>邮箱</a>
            </div>
          </div>

          <div className={`${s.t} ${s.c4} ${s.ink}`}>
            <div className={s.figs}>
              {profile.figures.map((f) => (
                <div key={f.label}>
                  <em />
                  <b>{f.value}</b>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Section no="01" title="研究与系统" count={`${featured.length} 项`} id="work" />
          {featured.slice(0, 3).map((p) => <Card key={p.slot} p={p} />)}

          <MeasurementChain />

          {featured.slice(3).map((p) => <Card key={p.slot} p={p} />)}

          <Section no="02" title="技能栈" count="每项都有项目对得上" id="skills" />
          <div className={`${s.t} ${s.c8}`}>
            <div className={s.sk}>
              {skills.map((k) => (
                <div key={k.k}>
                  <p className={s.k}>{k.k}</p>
                  <p>{k.v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`${s.t} ${s.c4}`} id="about">
            <span className={s.lbl}>教育与经历</span>
            <div style={{ marginTop: 16 }}>
              {experience.map((e) => (
                <div className={s.exp} key={e.org}>
                  <div className={s.org}>{e.org}</div>
                  <div className={s.what}>{e.what}</div>
                </div>
              ))}
            </div>
          </div>

          <Section no="03" title="其他项目" count={`${others.length} 项`} />
          <div className={`${s.t} ${s.c12}`}>
            <div className={s.list}>
              {others.map((o) => (
                <a key={o.name} href={o.href}>
                  <span className={s.tt}>{o.name}</span>
                  <span className={s.yy}>{o.year}</span>
                  <span className={s.dd}>{o.text}</span>
                </a>
              ))}
            </div>
          </div>

          <div className={`${s.t} ${s.c12} ${s.ink} ${s.closing}`} id="contact">
            <div>
              <h2 className={s.h2} style={{ margin: "0 0 6px" }}>{closing.title}</h2>
              <p className={s.closingSub}>
                {closing.sub}
                {closing.todo && <span className={s.dash}>{closing.todo}</span>}
              </p>
            </div>
            <div className={s.cta} style={{ margin: 0 }}>
              <a className={`${s.btn} ${s.pri}`} href={RESUME_CN}>简历 PDF</a>
              <a className={s.btn} href={RESUME_EN}>English CV</a>
              <a className={s.btn} href={EMAIL}>邮件联系</a>
              <a className={s.btn} href={profile.github}>GitHub ↗</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}