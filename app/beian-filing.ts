// The ICP filing string, in one place, because three consumers need the same one: the footer that
// renders it, the build check that asserts it reached every prerendered route, and the deployment
// check that asserts production is still serving it. A second copy is how a filing number and the
// thing that verifies it drift apart — and the drifting copy is usually the one readers see.
//
// A plain `.ts` module rather than a constant inside `site-beian.tsx`, so the scripts can import
// it: `node --experimental-strip-types` strips types but does not transform JSX.
//
// The number is the *service* filing (`…号-1`), not the bare 主体备案号 — see docs/ARCHITECTURE.md §6.
export const FILING = "京ICP备2026050077号-1";

export const REGISTRY_URL = "https://beian.miit.gov.cn/";

// Not filed yet. 公安联网备案 was submitted 2026-08-10 and takes 30 days; when it is granted, the
// number goes here and the footer grows a second link to https://www.beian.gov.cn/ — a different
// authority from MIIT's ICP filing, not a variant of it. Until then this stays null and both
// checks below skip it, which is why granting it is a one-file change and not a hunt.
export const PUBLIC_SECURITY_FILING: string | null = null;
