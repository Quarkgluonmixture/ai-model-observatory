import s from "./site-beian.module.css";

// The ICP filing strip. It is rendered by the root layout, not by either page, because the
// filing has to be on every route the domain serves — `/` and `/models` today, and whatever is
// added later by someone who has never read this file.
//
// The number is the *service* filing (`…号-1`), not the bare 主体备案号. Tencent Cloud requires the
// service number at the foot of a Beijing-filed site, linked to the MIIT registry, and also
// requires the filed apex and its www host to both serve — see docs/ARCHITECTURE.md §6.
const FILING = "京ICP备2026050077号-1";

export default function SiteBeian() {
  return (
    <footer className={s.strip} aria-label="备案信息">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
        {FILING}
      </a>
    </footer>
  );
}
