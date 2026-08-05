// Captures a Qwen release page's performance tables into a batch file.
//
//   node scripts/capture-qwen-release.mjs                    # writes data/sources/batch-17-*.jsonl
//   node scripts/capture-qwen-release.mjs --stdout           # print, write nothing
//
// Deliberately NOT a fetcher in scripts/fetchers/. A release post is published once and then
// frozen, so there is nothing for the daily job to re-read, and it would be the only source
// needing a browser. It lives here so the capture is reproducible rather than eye-transcribed:
// re-running it on the same page produces the same batch, byte for byte.
//
// The page renders client-side — fetching its HTML returns the single word "Qwen" — so this
// drives headless Chrome over CDP and reads the tables after the app has drawn them. Same
// launch pattern as scripts/check-mobile.mjs; set CHROME_PATH if Chrome is elsewhere.
//
// What it does NOT do: decide anything. The whole table is archived verbatim, including the
// columns for other makers' models. Which rows the dashboard accepts is data/model-aliases.json's
// job, and only Qwen3.8-Max is mapped — a vendor's numbers for a *competitor* carry no harness,
// no effort and no version, and source precedence puts them below every board that does.

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "https://qwen.ai/blog?id=qwen3.8";
const PUBLISHED = "2026-08-03";
const BATCH = "batch-17-qwen3.8-release";
const toStdout = process.argv.includes("--stdout");

// The published label -> the catalog's column, with the version that column already carries.
// Everything not named here is archived under its published label and left uncarried; the
// reason is one entry in droppedBenchmarks, so nobody re-derives the same list next release.
//
// `dual` names what the page's second number means. Two of these are checkable rather than
// assumed: the page prints GPT-5.6 Sol's ALE as "30.6 / 53.6" and Opus 4.8's OSWorld 2.0 as
// "20.6 / 54.8", and both official boards are already archived with 30.6 and 20.6 as the score
// and 53.6 / 54.8 recorded as the partial-credit figure. So the first number is the metric.
const CARRIED = {
  "Terminal Bench 2.1": { id: "terminal", version: "2.1", tools: true },
  "SWE-bench Pro": { id: "swe-pro", version: "Public", tools: true },
  "DeepSWE 1.1": { id: "deepswe", version: "v1.1", tools: true },
  "Agents' Last Exam (Pass / Score)": { id: "ale", version: "ALE-V1", tools: true, dual: "partial-credit score" },
  "Toolathlon Verified (Pass@1)": { id: "toolathlon", version: "Verified", tools: true },
  "HLE w/ tools": { id: "hle-tools", version: "Full", tools: true },
  "GPQA Diamond": { id: "gpqa", version: "Diamond", tools: false },
  HLE: { id: "hle-no-tools", version: "Full", tools: false },
  "MRCR v2 256K (8-needle)": { id: "mrcr", version: "v2 · 8 needle", tools: false, contextLength: "256K" },
  "MMMU-Pro": { id: "mmmu", version: "Pro", tools: false },
  "CharXiv (RQ)": { id: "charxiv", version: "RQ", tools: false, dual: "descriptive-question score" },
  "OSWorld 2.0": { id: "osworld2", version: "2.0", tools: true, dual: "partial score" },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connect = async (port) => {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((target) => target.type === "page");
      if (page) return page;
    } catch { /* chrome is still starting */ }
    await sleep(250);
  }
  throw new Error("headless Chrome did not expose a page target — set CHROME_PATH?");
};

const port = 9700 + (process.pid % 200);
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/qwen-capture-${port}`, "about:blank",
], { stdio: "ignore" });
chrome.on("error", (error) => { console.error(`cannot launch Chrome: ${error.message}`); process.exit(2); });

const target = await connect(port);
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
await send("Page.navigate", { url: PAGE });
await sleep(9000);

const EXTRACT = `(() => [...document.querySelectorAll("table")].map((table) =>
  [...table.querySelectorAll("tr")].map((tr) =>
    [...tr.querySelectorAll("th,td")].map((cell) => cell.innerText.trim().replace(/\\s+/g, " ")))))()`;
const { result } = await send("Runtime.evaluate", { expression: EXTRACT, returnByValue: true });
ws.close();
chrome.kill();

const tables = result.result.value;
if (!Array.isArray(tables) || tables.length === 0) throw new Error("no tables rendered — did the page change?");

const rows = [];
let section = null;
let sectionsSeen = 0;

for (const table of tables) {
  // The first row names the models. A table whose header has no model columns is a layout
  // table, not results — the page has one, and it renders as empty cells.
  const header = (table[0] ?? []).map((cell) => cell.trim());
  const models = header.slice(1).filter(Boolean);
  if (models.length === 0) continue;

  for (const cells of table.slice(1)) {
    const label = (cells[0] ?? "").trim();
    if (!label) continue;
    // A row with one filled cell is a section heading ("Coding Agent"), not a benchmark.
    if (cells.filter((cell) => cell.trim()).length === 1) { section = label; sectionsSeen += 1; continue; }

    const carried = CARRIED[label];
    for (const [index, model] of models.entries()) {
      const published = (cells[index + 1] ?? "").trim();
      // The page writes an unrun cell as "--". It is not a zero and it is not a row.
      if (!published || published === "--" || published === "-- / --") continue;

      const [primary, secondary] = published.split("/").map((part) => part.trim());
      const score = Number(primary);
      if (!Number.isFinite(score)) continue;

      const notes = [`Qwen3.8 发布页「${section ?? "performance"}」分区,原样抄录 ${label} 一行`];
      if (secondary && carried?.dual) notes.push(`${carried.dual} ${secondary}`);
      else if (secondary) notes.push(`页面同格第二个数 ${secondary},语义未标注,未采用`);
      notes.push("厂商发布材料:未标注 harness、reasoning effort 或运行日期");

      rows.push({
        model_raw: model,
        benchmark: carried?.id ?? label,
        benchmark_version: carried?.version ?? null,
        score,
        // Two rows on this page are Elo-like (QwenReactBench, QwenSVGBench print 1694, 1770).
        unit: score > 200 ? "Elo" : "%",
        harness: null,
        reasoning_effort: null,
        tools_enabled: carried ? carried.tools : null,
        context_length: carried?.contextLength ?? null,
        evaluation_date: PUBLISHED,
        source_label: "Qwen3.8 release",
        source_url: PAGE,
        source_kind: "vendor",
        note: notes.join(";"),
      });
    }
  }
}

const carriedRows = rows.filter((row) => row.model_raw === "Qwen3.8-Max" && row.benchmark_version !== null);
const summary = `${rows.length} rows across ${new Set(rows.map((r) => r.model_raw)).size} published model columns ` +
  `and ${new Set(rows.map((r) => r.benchmark)).size} benchmark labels, ${sectionsSeen} sections; ` +
  `${carriedRows.length} of them land in a catalog column`;

const jsonl = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
if (toStdout) {
  process.stdout.write(jsonl);
  console.error(summary);
} else {
  writeFileSync(join(ROOT, `data/sources/${BATCH}.jsonl`), jsonl);
  console.log(`Wrote ${BATCH}: ${summary}`);
}
