// Mobile layout probe. Drives headless Chrome over CDP with real device emulation and reports
// the three things that break a phone layout silently: horizontal document overflow, text below
// the legibility floor, and controls below the tap-target floor.
//
//   npm run build && PORT=3111 npm run start:next
//   npm run check:mobile                          # 320 / 390 / 430 against localhost:3111
//   node scripts/check-mobile.mjs http://localhost:3111 390 --shot=/tmp/shot.png
//
// Device emulation is the point. Headless Chrome sized with --window-size ignores the viewport
// meta tag entirely and reports overflow that no phone would ever show, which is how a "broken"
// layout gets chased for an hour. Not in CI: it needs Chrome and a running server.
//
// Exit code 1 on overflow. Type and tap-target findings print as warnings — see docs/UI.md §4.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIN_FONT_PX = 9;
// 36, not 44: a whole interactive row is 44px, but a segmented sub-button inside a 44px group
// (中 / EN, 模型 / 系统) is legitimately shorter. Below 36 nothing is comfortably tappable.
const MIN_TAP_PX = 36;
// The provenance tag under a score-table cell is a secondary annotation on an already legible
// number, and the live button hides its label by design. Both are documented in docs/UI.md §7.
const FONT_EXEMPT = [".score-table td.sourced small", ".axis-version", ".live", ".live em"];

const args = process.argv.slice(2);
const url = args.find(a => a.startsWith("http")) ?? "http://localhost:3111/";
const shot = args.find(a => a.startsWith("--shot="))?.slice(7);
const widths = args.filter(a => /^\d+$/.test(a)).map(Number);
const WIDTHS = widths.length ? widths : [320, 390, 430];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PROBE = `(() => {
  const EXEMPT = ${JSON.stringify(FONT_EXEMPT)};
  const label = (el) => {
    const own = (node) => node.tagName.toLowerCase() + (typeof node.className === "string" && node.className.trim() ? "." + node.className.trim().split(/\\s+/).join(".") : "");
    return (el.parentElement ? own(el.parentElement) + " > " : "") + own(el);
  };
  const exempt = (el) => EXEMPT.some(sel => el.matches(sel));
  const inScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if (o === "auto" || o === "scroll") return true;
    }
    return false;
  };
  // A rule that only applies at another breakpoint is not a finding: skip what is not rendered.
  const hidden = (el) => el.offsetParent === null && getComputedStyle(el).position !== "fixed";
  const vw = document.documentElement.clientWidth;
  const doc = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  const overflowing = [];
  const small = new Map();
  for (const el of document.querySelectorAll("body *")) {
    const box = el.getBoundingClientRect();
    if (box.width > 0 && box.right > vw + 1 && !inScroller(el)) overflowing.push(label(el) + " right=" + Math.round(box.right));
    const text = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (text && !exempt(el) && !hidden(el)) {
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < ${MIN_FONT_PX}) { const k = label(el) + " @" + size + "px"; small.set(k, (small.get(k) ?? 0) + 1); }
    }
  }
  const tiny = new Map();
  for (const el of document.querySelectorAll("a,button,input,select,label")) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    // An input inside a label is not its own target — the label is what the thumb hits.
    const wrapper = el.closest("label");
    if (wrapper && wrapper !== el && wrapper.getBoundingClientRect().height >= ${MIN_TAP_PX}) continue;
    if (box.height < ${MIN_TAP_PX}) { const k = label(el) + " h=" + Math.round(box.height); tiny.set(k, (tiny.get(k) ?? 0) + 1); }
  }
  const count = (m) => [...m.entries()].map(([k, n]) => n > 1 ? k + " ×" + n : k);
  return JSON.stringify({ vw, doc, overflowing: [...new Set(overflowing)].slice(0, 20), small: count(small), tiny: count(tiny) });
})()`;

async function connect(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find(t => t.type === "page");
      if (page) return page;
    } catch { /* chrome is still starting */ }
    await sleep(250);
  }
  throw new Error("headless Chrome did not expose a page target — set CHROME_PATH?");
}

const port = 9500 + (process.pid % 400);
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/observatory-cdp-${port}`, "about:blank",
], { stdio: "ignore" });
chrome.on("error", (error) => { console.error(`cannot launch Chrome: ${error.message}`); process.exit(2); });

const target = await connect(port);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener("open", resolve, { once: true }));

let seq = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, (message) => message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result));
  ws.send(JSON.stringify({ id, method, params }));
});

await send("Page.enable");
await send("Runtime.enable");

let failed = false;
for (const width of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 2, mobile: width <= 800 });
  await send("Emulation.setTouchEmulationEnabled", { enabled: width <= 800, maxTouchPoints: 5 });
  await send("Page.navigate", { url });
  await sleep(3000);

  const { result } = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const report = JSON.parse(result.value);
  const overflow = report.doc - report.vw;
  console.log(`\n${width}px — document ${report.doc}px vs viewport ${report.vw}px`);
  if (overflow > 0) {
    failed = true;
    console.log(`  FAIL horizontal overflow of ${overflow}px`);
    for (const item of report.overflowing) console.log(`    ${item}`);
  } else {
    console.log("  ok no horizontal overflow");
  }
  // The type and tap-target floors are the phone contract; a desktop width only owes no overflow.
  if (width > 800) continue;
  if (report.small.length) {
    console.log(`  warn ${report.small.length} selector(s) render text below ${MIN_FONT_PX}px`);
    for (const item of report.small) console.log(`    ${item}`);
  }
  if (report.tiny.length) {
    console.log(`  warn ${report.tiny.length} control(s) shorter than ${MIN_TAP_PX}px`);
    for (const item of report.tiny) console.log(`    ${item}`);
  }
  if (shot && width === WIDTHS[0]) {
    const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(shot, Buffer.from(image.data, "base64"));
    console.log(`  screenshot ${shot}`);
  }
}

ws.close();
chrome.kill();
console.log(failed ? "\nmobile layout check failed" : "\nmobile layout check passed");
process.exit(failed ? 1 : 0);
