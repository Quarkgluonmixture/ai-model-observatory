import s from "./site-beian.module.css";
import { FILING, PUBLIC_SECURITY_FILING, REGISTRY_URL } from "./beian-filing";

// The ICP filing strip. It is rendered by the root layout, not by either page, because the
// filing has to be on every route the domain serves — `/` and `/models` today, and whatever is
// added later by someone who has never read this file.
//
// The number itself lives in `beian-filing.ts` so that `npm run check:beian` and
// `npm run check:deployment` assert against the same string this renders, rather than a copy.
// Tencent Cloud requires the service number at the foot of a Beijing-filed site, linked to the
// MIIT registry, and also requires the filed apex and its www host to both serve — see
// docs/ARCHITECTURE.md §6.

export default function SiteBeian() {
  return (
    <footer className={s.strip} aria-label="备案信息">
      <a href={REGISTRY_URL} target="_blank" rel="noopener noreferrer">
        {FILING}
      </a>
      {PUBLIC_SECURITY_FILING ? (
        <a href="https://www.beian.gov.cn/" target="_blank" rel="noopener noreferrer">
          {PUBLIC_SECURITY_FILING}
        </a>
      ) : null}
    </footer>
  );
}
