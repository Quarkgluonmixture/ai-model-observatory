// Did the ICP filing reach every route the production build serves?
//
// This is the one requirement in this repository whose failure mode is not a wrong number on a
// dashboard — it is the domain being taken down. A Beijing-filed site must display its service
// filing, linked to the MIIT registry, on every route (docs/ARCHITECTURE.md §6). Until now
// nothing checked it: the filing was verified by hand across both hosts × both routes on
// 2026-08-10 and then had no regression net at all, which matters because 公安联网备案 lands
// around 2026-09-09 and will edit exactly this footer.
//
//   npm run check:beian     # after npm run build
//
// ## Why the build output and not the source
//
// Asserting that `site-beian.tsx` exists proves nothing: the footer is rendered by the root
// layout, and a route that does not use that layout silently loses it. What has to be true is
// that the string is in the HTML the host will serve, so that is what is read — the prerendered
// HTML `next build` writes for every static route.
//
// ## Fail-closed, deliberately
//
// Finding no HTML at all is a failure, not a pass. An empty whitelist reports the same green as a
// satisfied one, and this check exists precisely for the case where nobody is watching. Likewise
// the exclusion list below is a list of names, not a pattern: a pattern would quietly grow to
// cover a route that should have been caught.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FILING, PUBLIC_SECURITY_FILING } from "../app/beian-filing.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BUILD_DIR = join(ROOT, ".next/server/app");

// `_global-error` is React's global error boundary. It replaces the root layout rather than
// nesting inside it, so the footer is structurally absent — not missing. It is named here one
// route at a time so that adding a real route can never be excluded by accident.
const NOT_ROUTES = new Set(["_global-error"]);

let files;
try {
  files = readdirSync(BUILD_DIR).filter((name) => name.endsWith(".html"));
} catch {
  console.error(
    `No build output at ${BUILD_DIR}. Run \`npm run build\` first.\n` +
    "If the build did run, Next.js changed where it writes prerendered HTML and this check needs " +
    "rewriting — do not read this as the filing being present.",
  );
  process.exit(1);
}

const routes = files.filter((name) => !NOT_ROUTES.has(name.replace(/\.html$/, "")));

if (routes.length === 0) {
  console.error(
    `${files.length} HTML file(s) in the build output and none of them is a route. ` +
    "That is either a build that produced nothing or an exclusion list that has eaten everything; " +
    "either way this check cannot answer the question it exists to answer.",
  );
  process.exit(1);
}

const required = [
  ["ICP", FILING],
  ...(PUBLIC_SECURITY_FILING ? [["公安联网备案", PUBLIC_SECURITY_FILING]] : []),
];

const failures = [];
for (const file of routes) {
  const html = readFileSync(join(BUILD_DIR, file), "utf8");
  for (const [label, value] of required) {
    if (!html.includes(value)) failures.push(`/${file.replace(/\.html$/, "").replace(/^index$/, "")} — no ${label} filing (${value})`);
  }
}

const scale =
  `${routes.length} route(s) × ${required.length} filing(s)` +
  (files.length - routes.length ? `, ${files.length - routes.length} non-route page(s) skipped` : "");

if (failures.length === 0) {
  console.log(`ICP filing present on every prerendered route (${scale}).`);
  if (!PUBLIC_SECURITY_FILING) {
    console.log(
      "  note: 公安联网备案 is not filed yet, so only the ICP number is asserted. " +
      "Granting it means setting PUBLIC_SECURITY_FILING in app/beian-filing.ts — this check picks it up with no edit here.",
    );
  }
  process.exit(0);
}

console.error(`The production build is missing a required filing (${scale}):`);
for (const failure of failures) console.error(`- ${failure}`);
console.error(
  "\nThe filing has to be on every route the domain serves. If a route legitimately cannot carry " +
  "the root layout, name it in NOT_ROUTES in this file with the reason — do not widen the check.",
);
process.exit(1);
