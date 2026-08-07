// Is production actually serving what `main` says?
//
// `AGENTS.md` rule 11: GitHub `main` is the source of truth and EdgeOne Pages is the production
// host. Nothing verified the second half. Every other check in this repository asks whether the
// repository is right; none asked whether the thing readers open is the repository. The one
// notification that comes close — the WeChat push when `main` goes red — measures the repository's
// state, not the deployment's, and EdgeOne publishes on merge without reading CI at all. So a
// build that failed, or never fired, is silent: `main` is green, the site is last week's.
//
//   node scripts/check-deployment.mjs                 # uses data/deployment.json
//   node scripts/check-deployment.mjs --url https://…  # or an explicit target
//
// ## What it checks, and why not the obvious thing
//
// The obvious check is "does the page show the new benchmark". It does not survive contact with
// the page: `/models` is a client component whose catalog is collapsed by default, so the
// prerendered HTML carries 22 of 72 benchmark names, and rendering it through headless Chrome and
// reading `document.body.innerText` gives 6,345 characters — still 49 names short, because they
// are behind an expand. A check built on that would need to drive the UI, and a check that drives
// a UI breaks when the UI moves.
//
// The data does not depend on any of that. It is compiled into the page's JavaScript chunks, so
// the chunks are what gets read: fetch `/models`, follow every `<script src>` it names, and look
// for every catalog benchmark name and model name in the concatenated source. Measured against a
// local production build: 9 chunks, 1.5MB, every name present. A stale deployment is a deployment
// whose chunks predate the record — the name is simply not in them.
//
// ## It reports; it does not fail the job
//
// This runs inside the daily workflow, whose real work is refreshing the archive. A deployment
// that is behind is a fact somebody needs, not a reason to abandon the refresh — and an
// unconfigured URL certainly is not. Both are printed, and the daily job appends the output to the
// collection-gaps issue, where an unread line stays visible instead of scrolling past in a log.
// `--strict` makes it exit non-zero, for a caller that does want a hard failure.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BENCHMARKS, MODELS } from "../app/model-data.ts";

// fileURLToPath, not .pathname: on Windows a file URL's pathname is "/C:/..." — a
// leading slash that fs cannot resolve. The agent maintaining this runs there.
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const argOf = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};
const strict = args.includes("--strict");

const configured = (() => {
  if (argOf("url")) return argOf("url");
  if (process.env.SITE_URL) return process.env.SITE_URL;
  try {
    return JSON.parse(readFileSync(join(ROOT, "data/deployment.json"), "utf8")).productionUrl ?? null;
  } catch {
    return null;
  }
})();

if (!configured) {
  // Deliberately loud and deliberately not fatal. The address of production is a fact only the
  // owner has, and until it is written down this check cannot run — which is itself part of the
  // gap: you cannot verify a deployment whose address is nowhere in the repository.
  console.log(
    "⚠ **Deployment unverified: no production URL recorded.** Nothing in this repository says " +
    "where production is, so nothing can check whether it is serving what `main` says. EdgeOne " +
    "publishes on merge and does not read CI, so a build that failed or never fired is silent. " +
    "Fix: put the URL in `data/deployment.json` as `productionUrl`.",
  );
  process.exit(0);
}

const base = configured.replace(/\/+$/, "");

const fetchText = async (url) => {
  const response = await fetch(url, { headers: { "User-Agent": "ai-model-observatory deployment check" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  return response.text();
};

let html;
try {
  html = await fetchText(`${base}/models`);
} catch (error) {
  console.log(`⚠ **Production did not answer**: ${error.message}. That is either the host being down or the URL in \`data/deployment.json\` being wrong.`);
  process.exit(strict ? 1 : 0);
}

// Every `<script src>` the page names. Relative and absolute both, because a CDN may rewrite them.
const chunks = [...new Set([...html.matchAll(/src="([^"]+\.js)"/g)].map((match) => match[1]))];
let bundle = "";
const unreadable = [];
for (const chunk of chunks) {
  const url = chunk.startsWith("http") ? chunk : `${base}${chunk}`;
  try { bundle += await fetchText(url); } catch { unreadable.push(chunk); }
}

if (bundle.length === 0) {
  console.log(
    `⚠ **Production served no readable JavaScript** for \`/models\` (${chunks.length} script tag(s) found). ` +
    "Either the deployment is broken or the build output changed shape and this check needs rewriting — " +
    "do not read this as the site being fine.",
  );
  process.exit(strict ? 1 : 0);
}

const missingBenchmarks = BENCHMARKS.filter((benchmark) => !bundle.includes(benchmark.name)).map((b) => b.name);
const missingModels = MODELS.filter((model) => !bundle.includes(model.name)).map((m) => m.name);
const missing = [...missingBenchmarks, ...missingModels];

const scale = `${MODELS.length} models × ${BENCHMARKS.length} benchmarks, ${chunks.length} chunk(s), ${Math.round(bundle.length / 1024)}KB`;

if (missing.length === 0) {
  console.log(`Deployment matches \`main\`: every catalog name is in what ${base} serves (${scale}).`);
  if (unreadable.length) console.log(`  note: ${unreadable.length} chunk(s) could not be fetched and were not searched.`);
  process.exit(0);
}

console.log(
  `⚠ **Production is behind \`main\`** — ${missing.length} catalog name(s) are absent from what ${base} serves ` +
  `(${scale}). EdgeOne publishes on merge without reading CI, so the likely cause is a build that failed or ` +
  "never fired. What is missing:",
);
for (const name of missing.slice(0, 12)) console.log(`- ${name}`);
if (missing.length > 12) console.log(`- …and ${missing.length - 12} more`);
if (unreadable.length) console.log(`  note: ${unreadable.length} chunk(s) could not be fetched, so some of these may be false alarms.`);
process.exit(strict ? 1 : 0);
