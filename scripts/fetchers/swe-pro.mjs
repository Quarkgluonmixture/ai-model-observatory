// SWE-Bench Pro (Public), read out of the page's own React server payload.
//
// Batch 02 transcribed this board by hand and froze it: 25 rows, correct to the digit, and blind
// forever after — Scale evaluating a new model would never be noticed, because a hand-transcribed
// batch has no drift check. This reads the same 25 rows by script, which is what turns the board
// into something that re-reads itself.
//
// ## Where the data is
//
// There is no JSON endpoint. `labs.scale.com` is a Next.js App Router site, and asking the
// leaderboard URL for its React Server Component payload — a plain GET with `RSC: 1` — returns the
// flight stream, which carries the whole board inline as unescaped JSON under `"entries"`:
//
//   {"model":"Muse Spark 1.1*","version":"","rank":1,"score":61.5,
//    "confidenceInterval_upper":3.1,"contaminationMessage":"","company":"meta",
//    "isNew":true,"new":true,"createdAt":"2026-07-09T18:04:14.000Z","deprecated":false,
//    "maxScore":66.538}
//
// ⚠ **This is not a stable API.** The flight format is React's internal serialisation and Scale can
// change it by upgrading Next.js, with no notice and no deprecation. That is the honest cost of this
// fetcher and it is the reason every assumption below is asserted rather than assumed: this file's
// failure mode must be a loud throw on the next daily run, never a silently smaller board. A
// silently-empty read here would look exactly like "Scale removed every model", which the drift
// check would then report as an integrity failure against the archive.
//
// ## The asterisk is a harness, and getting it wrong would merge two scaffolds in one cell
//
// The page states both scaffolds in prose, and both are asserted on every fetch:
//
//   "We ran frontier models on Pro using the SWE-Agent scaffold"   <- the default
//   "*Run with mini-swe-agent harness"                            <- the asterisked rows
//
// So `Muse Spark 1.1*` is mini-swe-agent and `claude-4-5-Sonnet` is SWE-Agent. Batch 02's
// transcriber read it the same way, which is why superseding those rows keeps every cell
// comparable — rule 4 in AGENTS.md is that a harness difference is never merged away. If either
// sentence disappears from the page, this fetcher throws instead of guessing, because a wrong
// harness label is indistinguishable from a real result.
//
// ## Live, not pinned
//
// Scale appends models to this board, so a new row is new data and a moved score is Scale
// re-running something, not history being rewritten. `versioning: "live"` — a difference opens a
// pull request rather than failing the integrity check.

const SITE = "https://labs.scale.com";
const PAGE = `${SITE}/leaderboard/swe_bench_pro_public`;

// Recorded as the source states it. `versionAliases` in data/model-aliases.json maps
// "Public Dataset" onto the existing rows' "Public", so this lands in the same catalog cell rather
// than opening a second column for the same split.
const VERSION = "Public Dataset";

// Sentences the harness attribution depends on. Asserted, not trusted.
const DEFAULT_HARNESS_CLAIM = "using the SWE-Agent scaffold";
const DEFAULT_HARNESS = "SWE-Agent";
const STARRED_HARNESS_CLAIM = "*Run with mini-swe-agent harness";
const STARRED_HARNESS = "mini-swe-agent";
// The split this board is: if Scale re-bases it, the rows are no longer the same benchmark.
const SPLIT_CLAIM = "731 instances";
const SPLIT_SIZE = 731;

// A parenthetical on this board is an operating point, and only an operating point is taken as one.
// Anything else stays inside `model_raw` untouched and the row carries no effort, because a size or
// variant word is not an effort — the same rule `propose-attribution.mjs` applies. Case is
// preserved exactly as published (`xHigh`, not `xhigh`): the alias file keys on the published
// string, and batch 02 recorded these same spellings.
const EFFORT_WORDS = new Set([
  "max", "xhigh", "high", "medium", "low", "minimal", "none", "auto",
  "thinking", "non-thinking", "reasoning", "non-reasoning",
]);

/**
 * The JSON array that follows `"entries":`, found by balancing brackets rather than by a regular
 * expression — a model name may contain a bracket, and `[^\]]*` would stop at it. String-aware, so
 * a `]` inside a name cannot close the array either.
 */
const entriesArray = (payload) => {
  const at = payload.indexOf('"entries":');
  if (at === -1) return null;
  const start = payload.indexOf("[", at);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < payload.length; i += 1) {
    const char = payload[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) return payload.slice(start, i + 1);
    }
  }
  return null;
};

export const swePro = {
  id: "swe-pro",
  // The same label batch 02 used, so both count against one source card instead of inventing a
  // second card for one board.
  label: "SWE-Bench Pro Public official leaderboard",
  batch: "batch-30-swe-pro",
  versioning: "live",

  async fetch() {
    const response = await fetch(PAGE, {
      headers: {
        // The whole mechanism. Without this header the same URL returns HTML whose table is
        // client-rendered and carries no scores.
        RSC: "1",
        // Scale serves 403 to an unfamiliar client, which is a "the source cannot be read"
        // failure that looks like the source going away.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        Accept: "text/x-component,*/*",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${PAGE}`);
    const payload = await response.text();

    // Every assertion below exists because the alternative is a plausible-looking wrong row.
    if (!payload.includes(DEFAULT_HARNESS_CLAIM)) {
      throw new Error(
        `${PAGE} no longer says "${DEFAULT_HARNESS_CLAIM}" — the default harness for unstarred rows ` +
        "is no longer established, and labelling them ${DEFAULT_HARNESS} would be a guess",
      );
    }
    if (!payload.includes(STARRED_HARNESS_CLAIM)) {
      throw new Error(
        `${PAGE} no longer carries the footnote "${STARRED_HARNESS_CLAIM}" — the asterisk on a model ` +
        "name can no longer be read as a harness",
      );
    }
    if (!payload.includes(SPLIT_CLAIM)) {
      throw new Error(`${PAGE} no longer states "${SPLIT_CLAIM}" — the public split may have been re-based`);
    }

    const json = entriesArray(payload);
    if (!json) {
      throw new Error(
        `no "entries" array in the RSC payload for ${PAGE} (${payload.length} bytes) — the flight ` +
        "format changed; see this file's header, this is the known cost of reading it",
      );
    }
    let entries;
    try {
      entries = JSON.parse(json);
    } catch (error) {
      throw new Error(`the "entries" array in ${PAGE} did not parse: ${error.message}`);
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error(`the "entries" array in ${PAGE} is empty — treating that as new data would erase the board`);
    }

    const rows = entries
      // `deprecated` is Scale's own flag for a row it no longer stands behind. There is a separate
      // deprecated board (linked from this page) and those rows belong to it, not here.
      .filter((entry) => entry && entry.deprecated !== true)
      .filter((entry) => typeof entry.model === "string" && Number.isFinite(entry.score))
      .map((entry) => {
        const starred = entry.model.trim().endsWith("*");
        const parenthetical = /\(([^()]+)\)/.exec(entry.model)?.[1]?.trim() ?? null;
        const effort = parenthetical && EFFORT_WORDS.has(parenthetical.toLowerCase()) ? parenthetical : null;
        const interval = Number.isFinite(entry.confidenceInterval_upper)
          ? `±${entry.confidenceInterval_upper.toFixed(2)}`
          : null;
        return {
          // Verbatim, asterisk included: the alias file keys on the published string and batch 02
          // recorded these exact spellings. Stripping the star would orphan every alias.
          model_raw: entry.model,
          benchmark: "swe-pro",
          benchmark_version: VERSION,
          score: entry.score,
          unit: "%",
          harness: starred ? STARRED_HARNESS : DEFAULT_HARNESS,
          reasoning_effort: effort,
          // The board is agentic by construction — a scaffold resolving real repository issues —
          // but it publishes no tool list, and `true` here would be an inference about a field the
          // source never states.
          tools_enabled: null,
          context_length: null,
          // Per row and only moves when Scale actually re-runs something, unlike a page-level
          // build timestamp, which would make every re-fetch look like new data.
          evaluation_date: typeof entry.createdAt === "string" ? entry.createdAt.slice(0, 10) : null,
          source_label: "SWE-Bench Pro Public official leaderboard",
          source_url: PAGE,
          source_kind: "benchmark",
          note:
            `${interval ? `${interval}; ` : ""}${SPLIT_SIZE} instances` +
            `${Number.isFinite(entry.rank) ? `；榜上第 ${entry.rank}` : ""}` +
            `${Number.isFinite(entry.maxScore) ? `；该模型在此板的历史最高 ${entry.maxScore}` : ""}` +
            `${entry.company ? `；Scale 记的厂商 ${entry.company}` : ""}` +
            `${entry.contaminationMessage ? `；污染提示「${entry.contaminationMessage}」` : ""}` +
            `；harness ${starred ? `${STARRED_HARNESS}（模型名带 *）` : `${DEFAULT_HARNESS}（板子默认）`}` +
            "；读自页面自己的 RSC flight 载荷，非人工转录",
        };
      });

    if (rows.length === 0) {
      throw new Error(`${PAGE} returned ${entries.length} entries and none survived filtering — the row shape changed`);
    }

    const starred = rows.filter((row) => row.harness === STARRED_HARNESS).length;
    const dropped = entries.length - rows.length;
    return {
      rows,
      version: VERSION,
      summary:
        `${rows.length} rows (${starred} on ${STARRED_HARNESS}, ${rows.length - starred} on ${DEFAULT_HARNESS})` +
        `${dropped ? `, ${dropped} deprecated or malformed entr${dropped === 1 ? "y" : "ies"} skipped` : ""}`,
      meta: {
        batch: "30 · SWE-Bench Pro Public, scripted",
        collectedWith: "scripts/fetchers/swe-pro.mjs",
        filtered: false,
        release: VERSION,
        sources: [PAGE],
        note:
          "Read from the page's own React Server Component payload (a GET with `RSC: 1`), which " +
          "carries the board inline as JSON under `entries`. There is no JSON API; batch 02 " +
          "transcribed the same board by hand and its swe-pro rows are superseded by this batch, " +
          "recorded in data/model-aliases.json. harness is derived per row from the asterisk on " +
          "the model name, which the page's own footnote defines as mini-swe-agent against a " +
          "SWE-Agent default; both sentences are asserted on every fetch, so a wording change " +
          "throws rather than mislabelling a scaffold. `deprecated: true` entries are skipped — " +
          "Scale keeps a separate deprecated board for them. tools_enabled stays null because the " +
          "board publishes no tool list. The RSC flight format is React-internal and not a stable " +
          "API: that is the known risk of this source, mitigated by failing loudly rather than " +
          "returning a smaller board.",
      },
    };
  },
};
