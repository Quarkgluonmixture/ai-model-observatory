// Watches every maker's release index for a post that was not there yesterday.
//
//   node scripts/release-probe.mjs             # report what is new since the snapshot
//   node scripts/release-probe.mjs --write     # ...and record the current state as seen
//   node scripts/release-probe.mjs --only qwen
//
// The gap this fills: `check:upstream` asks whether an archived number moved, and report:gaps
// asks whether a provider started serving a model. Neither looks at the page where a maker
// publishes its benchmark table. Qwen3.8 Max was served, detected and filed in the gaps issue on
// 2026-08-03 while its ~80-benchmark release table went unread for two days.
//
// It reports posts, never scores. Turning a post into rows means deciding which published label
// belongs in which catalog column, and that decision is recorded per source, not inferred here.
//
// Several of these pages render client-side, so this drives headless Chrome the same way
// scripts/capture-release-tables.mjs does. A page that cannot be read is reported as unreadable
// and does not fail the run: one maker changing its site must not stop the other eight from
// being checked, and a probe that fails closed would be silenced within a week.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CONFIG = join(ROOT, "data/release-pages.json");
const SNAPSHOT = join(ROOT, "data/release-pages.snapshot.json");

const args = process.argv.slice(2);
const write = args.includes("--write");
const onlyIndex = args.indexOf("--only");
const only = onlyIndex === -1 ? null : args[onlyIndex + 1];

const { pages } = JSON.parse(readFileSync(CONFIG, "utf8"));
const all = only ? pages.filter((page) => page.id === only) : pages;
if (!all.length) throw new Error(`no release page with id "${only}"`);
// `mode: "none"` is a measured dead end, not a gap in this file. Probing it every morning would
// produce the same failure every morning, which is how a report gets ignored.
const selected = all.filter((page) => page.mode !== "none");
const noPath = all.filter((page) => page.mode === "none");
const feeds = selected.filter((page) => page.mode === "feed");
// Server-rendered HTML: the links are in the bytes, so no browser and no wait. Three of the four
// makers that looked shut turned out to publish exactly this — on a *documentation* host rather
// than the marketing site that was blocking us.
const plain = selected.filter((page) => page.mode === "html");
const rendered = selected.filter((page) => page.mode === "render" || page.mode === "render-cards");

const previous = (() => {
  try { return JSON.parse(readFileSync(SNAPSHOT, "utf8")); } catch { return { pages: {} }; }
})();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connect = async (port) => {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((entry) => entry.type === "page");
      if (page) return page;
    } catch { /* chrome is still starting */ }
    await sleep(250);
  }
  throw new Error("headless Chrome did not expose a page target — set CHROME_PATH?");
};

const snapshot = { checkedAt: new Date().toISOString().slice(0, 10), pages: {} };
const findings = [];
const unreadable = [];

// Which new posts are worth interrupting somebody for. Every new post goes in the report; only a
// post that looks like a model launch is pushed to a phone, because a maker publishes policy
// notes, customer stories and course pages through the same feed and a notification stream that
// includes all of them stops being read within a week.
//
// It is a heuristic and it will miss one eventually — which is exactly why the full list stays in
// the gaps issue and the push says how many other posts it did not mention.
// The trailing \b was a bug worth keeping the scar for: "Qwen3.8-Max" has no word boundary
// between the name and the version, so the one post this whole probe exists to catch would have
// been filed as routine and never pushed. Names run into their numbers as often as not.
const RELEASE_SIGNAL = /introduc|releas|launch|announc|now available|发布|上线|开源|\b(gpt|claude|gemini|grok|kimi|glm|minimax|qwen|deepseek|llama|muse|inkling)[- ]?[0-9]/i;
const looksLikeRelease = (post) => RELEASE_SIGNAL.test(`${post.title} ${post.path}`);

// Feeds first, and without a browser. A feed is a data file: no JavaScript to run, no layout to
// break, and — the reason this ordering is not merely tidy — no bot challenge. OpenAI's HTML
// index answers headless Chrome with Cloudflare's interstitial and zero links, while its RSS
// answers 200 with the whole list.
const FEED_ITEM = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/g;
const tagOf = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (match) return match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
  const href = xml.match(new RegExp(`<${tag}[^>]*href="([^"]+)"`));
  return href ? href[1] : null;
};

for (const page of feeds) {
  try {
    const response = await fetch(page.url, { headers: { "user-agent": "Mozilla/5.0 (ai-model-observatory release probe)" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const xml = await response.text();
    const items = (xml.match(FEED_ITEM) ?? []).map((item) => ({
      path: tagOf(item, "guid") ?? tagOf(item, "link") ?? tagOf(item, "id"),
      href: tagOf(item, "link") ?? tagOf(item, "guid"),
      title: tagOf(item, "title") ?? "",
    })).filter((item) => item.path);
    if (!items.length) throw new Error("feed parsed but carried no items");
    // A maker's feed is rarely only releases. OpenAI's carries 1,042 posts under /index/ and 30
    // course pages under /academy/; the filter keeps the sections that can contain a launch.
    const kept = page.match ? items.filter((item) => new RegExp(page.match).test(item.path)) : items;
    if (!kept.length) throw new Error(`feed parsed, but no item matched ${page.match} (${items.length} items)`);
    snapshot.pages[page.id] = kept.map((item) => item.path).sort();
    const before = new Set(previous.pages?.[page.id] ?? []);
    if (before.size === 0) continue;
    for (const item of kept) if (!before.has(item.path)) findings.push({ ...page, post: item });
  } catch (error) {
    unreadable.push({ ...page, reason: error.message });
  }
}

const HREF = /href="([^"]+)"/g;
for (const page of plain) {
  try {
    const response = await fetch(page.url, { headers: { "user-agent": "Mozilla/5.0 (ai-model-observatory release probe)" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    const pattern = new RegExp(page.match);
    const posts = new Map();
    for (const [, href] of html.matchAll(HREF)) {
      let url;
      try { url = new URL(href, page.url); } catch { continue; }
      // Absolute and relative forms of one link must compare equal: xAI's release notes link out
      // to x.ai/news/... while its own navigation is relative.
      const path = url.pathname + url.search;
      if (!pattern.test(path) || posts.has(path)) continue;
      posts.set(path, { path, href: url.href, title: path.split("/").filter(Boolean).at(-1).replace(/-/g, " ") });
    }
    if (posts.size === 0) throw new Error(`fetched, but no link matched ${page.match}`);
    snapshot.pages[page.id] = [...posts.keys()].sort();
    const before = new Set(previous.pages?.[page.id] ?? []);
    if (before.size === 0) continue;
    for (const post of posts.values()) if (!before.has(post.path)) findings.push({ ...page, post });
  } catch (error) {
    unreadable.push({ ...page, reason: error.message });
  }
}

if (rendered.length === 0) {
  report();
  process.exit(0);
}

const port = 9300 + (process.pid % 200);
const chrome = spawn(CHROME, [
  // --no-sandbox because this runs on a CI container as well as a laptop, and it only ever
  // loads public pages it does not interact with.
  "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/release-probe-${port}`, "about:blank",
], { stdio: "ignore" });
// No browser is a degraded run, not a failed one. The feed sources have already been read by this
// point and their findings are real; losing them because a runner has no Chrome would mean the
// probe reports nothing on exactly the days somebody changed the image.
let browserError = null;
chrome.on("error", (error) => { browserError = error.message; });

const target = await connect(port).catch((error) => { browserError = browserError ?? error.message; return null; });
if (!target) {
  for (const page of rendered) unreadable.push({ ...page, reason: `no browser: ${browserError}` });
  chrome.kill();
  report();
  process.exit(0);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));

let seq = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

await send("Page.enable");

// Anchors, as href + the text a person would recognise the post by. `new URL` against the page
// so a relative link and an absolute one compare equal — makers use both, sometimes on one page.
const LINKS = (base) => `(() => {
  const seen = new Map();
  for (const a of document.querySelectorAll("a[href]")) {
    let url; try { url = new URL(a.getAttribute("href"), ${JSON.stringify(base)}); } catch { continue; }
    const title = (a.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 120);
    if (!seen.has(url.pathname + url.search)) seen.set(url.pathname + url.search, { href: url.href, title });
  }
  return JSON.stringify([...seen.entries()].map(([path, value]) => ({ path, ...value })));
})()`;

// Some indexes are not made of links at all. Qwen's renders nine cards and exactly one anchor,
// which is the cookie notice — the cards are divs with a router click handler. Their class names
// carry a build hash (`Advancement__Date--cJPvS7WW`) and would break on the next deploy, so this
// keys on structure instead: a leaf element whose whole text is a date, walked up to the nearest
// ancestor big enough to be the card.
const CARDS = `(() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length !== 0) continue;
    const text = (el.textContent || "").trim();
    if (!/^20\\d\\d[\\/-]\\d\\d[\\/-]\\d\\d$/.test(text)) continue;
    let card = el;
    while (card.parentElement && (card.innerText || "").trim().length < 60) card = card.parentElement;
    const lines = (card.innerText || "").split("\\n").map((line) => line.trim()).filter(Boolean);
    const title = lines.find((line) => line.length > 12 && !/^20\\d\\d[\\/-]/.test(line)) ?? lines[0];
    if (title) out.push({ date: text.replace(/\\//g, "-"), title: title.slice(0, 120) });
  }
  const seen = new Set();
  return JSON.stringify(out.filter((entry) => !seen.has(entry.title) && seen.add(entry.title)));
})()`;

for (const page of rendered) {
  if (page.mode === "render-cards") {
    try {
      await send("Page.navigate", { url: page.url });
      await sleep(12000);
      const { result } = await send("Runtime.evaluate", { expression: CARDS, returnByValue: true });
      const cards = JSON.parse(result.result.value ?? "[]");
      if (cards.length === 0) throw new Error("rendered, but no dated card was found");
      // The title is the identity: this index publishes no per-post URL, and the date moves
      // between the card and the article by a day.
      snapshot.pages[page.id] = cards.map((card) => card.title).sort();
      const before = new Set(previous.pages?.[page.id] ?? []);
      if (before.size === 0) continue;
      for (const card of cards) {
        if (!before.has(card.title)) findings.push({ ...page, post: { path: card.title, href: page.url, title: `${card.title} (${card.date})` } });
      }
    } catch (error) {
      unreadable.push({ ...page, reason: error.message });
    }
    continue;
  }

  let links = [];
  try {
    await send("Page.navigate", { url: page.url });
    await sleep(7000);
    const { result } = await send("Runtime.evaluate", { expression: LINKS(page.url), returnByValue: true });
    links = JSON.parse(result.result.value ?? "[]");
  } catch (error) {
    unreadable.push({ ...page, reason: error.message });
    continue;
  }

  const pattern = new RegExp(page.match);
  const posts = links.filter((link) => pattern.test(link.path));
  if (posts.length === 0) {
    // Not an error, but not a reading either: a page that renders and matches nothing usually
    // means the site was restructured and the `match` is now wrong. Saying so is the point.
    unreadable.push({ ...page, reason: `rendered, but no link matched ${page.match} (${links.length} links on the page)` });
    continue;
  }

  snapshot.pages[page.id] = posts.map((post) => post.path).sort();
  const before = new Set(previous.pages?.[page.id] ?? []);
  // A first run has nothing to compare against. Reporting the whole index as "new" would be
  // technically true and completely useless, so the first sight of a page only records it.
  if (before.size === 0) continue;

  for (const post of posts) {
    if (!before.has(post.path)) findings.push({ ...page, post });
  }
}

ws.close();
chrome.kill();

report();

function report() {
  if (write) writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n");

  const signals = findings.filter((finding) => looksLikeRelease(finding.post));
  const rest = findings.filter((finding) => !looksLikeRelease(finding.post));

  const lines = [];
  if (findings.length) {
    lines.push("## Release posts published since the last check");
    lines.push("");
    for (const finding of signals) {
      lines.push(`- **${finding.maker}** — [${finding.post.title || finding.post.path}](${finding.post.href}) ⟵ looks like a launch`);
    }
    for (const finding of rest) {
      lines.push(`- ${finding.maker} — [${finding.post.title || finding.post.path}](${finding.post.href})`);
    }
    lines.push("");
    lines.push("A release post is where a maker publishes its benchmark table, and that table is where core");
    lines.push("cells come from — Qwen's carried 12 of them. Capture one with");
    lines.push("`node scripts/capture-release-tables.mjs <id>` — its per-source label mapping is judgement and");
    lines.push("lives in the script. Nothing is collected automatically: which published label belongs");
    lines.push("in which catalog column is judgement.");
    lines.push("");
  }
  if (unreadable.length) {
    lines.push("## Release indexes that broke");
    lines.push("");
    for (const entry of unreadable) lines.push(`- **${entry.maker}** (${entry.url}) — ${entry.reason}`);
    lines.push("");
    lines.push("These have a recorded path that stopped working, which is different from having none.");
    lines.push("");
  }
  if (noPath.length) {
    lines.push(`_${noPath.length} maker(s) have no readable release index and are not probed: ` +
      `${noPath.map((page) => page.maker).join(", ")}. The reason for each is in data/release-pages.json; ` +
      `they are listed so the same dead ends are not rediscovered._`);
    lines.push("");
  }

  process.stdout.write(lines.join("\n"));
  console.error(`checked ${selected.length - unreadable.length}/${selected.length} indexes; ${findings.length} new post(s)`);
  console.log(`<!-- release-posts: ${findings.length} -->`);
  console.log(`<!-- release-signals: ${signals.length} -->`);
}
