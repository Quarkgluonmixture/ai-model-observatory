// Reads a page that only exists after its JavaScript runs.
//
// Three places need this now — the release probe, the Qwen release capture and the GDPval
// fetcher — and a fourth copy of the CDP handshake would be a fourth place to fix when Chrome
// changes. `scripts/check-mobile.mjs` deliberately keeps its own: it drives device emulation and
// measures layout, which is a different job from reading a table.
//
// A rendered source is a last resort, not a convenience. Prefer the page's own data file, then a
// feed, then this — see docs/ARCHITECTURE.md §9, where the sources that turned out to have one
// are recorded next to the ones that genuinely do not.

import { spawn } from "node:child_process";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
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

/**
 * Opens one browser, hands back an `evaluate(url, expression)` and a `close()`.
 * The caller keeps the browser for as long as it needs; opening one per page costs a second each.
 */
export const openBrowser = async () => {
  // Ports are derived from the pid so two of these can run at once without colliding — the
  // release probe and a fetcher both want a browser, and the daily job may run them together.
  const port = 9000 + (process.pid % 900);
  const chrome = spawn(CHROME, [
    // --no-sandbox because this runs on a CI container as well as a laptop, and it only ever
    // loads public pages it does not interact with.
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/observatory-render-${port}`, "about:blank",
  ], { stdio: "ignore" });

  let launchError = null;
  chrome.on("error", (error) => { launchError = error.message; });

  const target = await connect(port).catch((error) => {
    throw new Error(launchError ? `cannot launch Chrome: ${launchError}` : error.message);
  });

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

  return {
    /**
     * Navigates and evaluates `expression` once the app has had `settleMs` to draw. There is no
     * load event worth waiting for here: these pages resolve their own data after hydration, so
     * "the document finished loading" and "the table exists" are seconds apart.
     */
    async evaluate(url, expression, settleMs = 9000) {
      await send("Page.navigate", { url });
      await sleep(settleMs);
      const { result } = await send("Runtime.evaluate", { expression, returnByValue: true });
      if (result?.exceptionDetails) {
        throw new Error(`page script failed on ${url}: ${result.exceptionDetails.text}`);
      }
      return result?.result?.value;
    },
    close() {
      ws.close();
      chrome.kill();
    },
  };
};

/** Every `<table>` on the page, as rows of trimmed cell text. */
export const TABLES_EXPRESSION = `(() => [...document.querySelectorAll("table")].map((table) =>
  [...table.querySelectorAll("tr")].map((tr) =>
    [...tr.querySelectorAll("th,td")].map((cell) => cell.innerText.trim().replace(/\\s+/g, " ")))))()`;
