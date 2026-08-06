// LM Arena's human-preference Elo, read from the boards themselves.
//
// §9 recorded LM Arena as unscriptable. That verdict was about `lmarena/arena-catalog`, a GitHub
// mirror that decodes perfectly and stopped syncing a generation ago — and it was a claim about
// the search, not about the source. The site now redirects `lmarena.ai` to `arena.ai` and serves
// each board **server-rendered**: the whole snapshot is embedded in the HTML as JSON, so this
// needs neither a browser nor an API key. The documented-looking API path under `/api/` answers
// 403 "Route not allowed"; the page's own payload is the published artefact, the same relationship
// LiveBench's CSV has to LiveBench's table.
//
// Two boards, because the catalog carries two numbers:
//
//   textElo  <- text-overall-style_control   (Claude Fable 5 = 1508.58; the archive says 1508)
//   codeElo  <- webdev-overall-raw           (claude-opus-5-max = 1705; the archive says 1712)
//
// Both were confirmed the way AGENTS.md requires — by taking a model the catalog already holds and
// checking the page agrees. The code numbers sit a few points below the archive because that board
// is ten days newer, which is the point: those are the values that were going stale invisibly.
// Model strings match the archive's exactly (`claude-opus-5-max`, `kimi-k3-max`), so the aliases
// written for the hand-read batch resolve these rows with nothing new to decide.
//
// LIVE, and more so than any other source here: an Elo moves with every vote. That is why the
// catalog no longer carries the number — `npm run ingest` derives it from this archive — and why a
// difference here opens a refresh rather than failing the integrity check.
//
// One thing in the payload is deliberately dropped. Each entry carries `inputPricePerMillion` and
// `outputPricePerMillion`, and AGENTS.md is explicit that LM Arena's price column is not a price
// source: it names no tier and no region, so it cannot be reconciled with a vendor page that
// prices Standard, Batch and Priority differently. The fields stay null here so that nothing in
// this batch can ever satisfy a price check.

const SITE = "https://arena.ai";

const BOARDS = [
  {
    slug: "text-overall-style_control",
    page: `${SITE}/leaderboard/text`,
    label: "LMArena Text Arena overall (style control)",
    field: "text_elo",
  },
  {
    slug: "webdev-overall-raw",
    page: `${SITE}/leaderboard/code/webdev`,
    label: "LMArena Code/WebDev Arena",
    field: "code_elo",
  },
];

// A closed list, and the same one the archive already uses: 36 of its Elo rows carry no effort at
// all, the rest carry max / xhigh / high / thinking. A size or tier word is never an effort — see
// the attribution rule — so nothing else is stripped, and an unrecognised suffix simply leaves the
// row effort-less, which is the model-level reading.
const EFFORTS = ["max", "xhigh", "high", "medium", "low", "thinking"];

const effortOf = (name) => EFFORTS.find((effort) => name.toLowerCase().endsWith(`-${effort}`)) ?? null;

// The payload is JSON escaped into a JavaScript string, so a plain JSON.parse of the page is not
// on the table. Rather than matching fields in the order they happen to appear — which makes a
// silent zero-row parse the failure mode when the site reorders a key — this unescapes the region,
// finds the board's own `entries` array by its snapshot id, and bracket-matches to the end of it so
// the array can be parsed as the JSON it is. A shape change then throws instead of returning
// nothing, and the runner reports the source as unreadable rather than as empty.
const sliceArray = (text, from) => {
  const open = text.indexOf("[", from);
  if (open === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = open; index < text.length; index++) {
    const char = text[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return text.slice(open, index + 1);
  }
  return null;
};

const entriesFor = (html, slug) => {
  const text = html.replace(/\\"/g, '"');
  const anchor = text.indexOf(`leaderboards/${slug}/leaderboard-snapshots`);
  if (anchor === -1) throw new Error(`board ${slug} is not on the page — the site's shape changed`);
  const marker = text.indexOf('"entries"', anchor);
  if (marker === -1) throw new Error(`board ${slug} carries no entries array`);
  const raw = sliceArray(text, marker);
  if (!raw) throw new Error(`board ${slug}'s entries array is not delimited — the payload shape changed`);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`board ${slug}'s entries array did not parse as JSON: ${error.message}`);
  }
  return parsed
    .filter((entry) => entry && typeof entry.modelDisplayName === "string" && Number.isFinite(entry.rating))
    .map((entry) => ({
      name: entry.modelDisplayName,
      rating: entry.rating,
      upper: Number.isFinite(entry.ratingUpper) ? entry.ratingUpper : entry.rating,
      lower: Number.isFinite(entry.ratingLower) ? entry.ratingLower : entry.rating,
      votes: Number.isFinite(entry.votes) ? entry.votes : null,
      organization: typeof entry.modelOrganization === "string" ? entry.modelOrganization : null,
    }));
};

export const arena = {
  id: "arena",
  label: "LMArena human preference Elo",
  batch: "batch-22-arena",
  versioning: "live",

  async fetch() {
    const byModel = new Map();
    const counts = [];

    for (const board of BOARDS) {
      const response = await fetch(board.page, {
        headers: {
          // The bare default gets a redirect loop off lmarena.ai; a browser UA follows through to
          // arena.ai and gets the server-rendered payload.
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${board.page}`);
      const entries = entriesFor(await response.text(), board.slug);
      if (entries.length === 0) throw new Error(`board ${board.slug} parsed to zero entries — the payload shape changed`);
      counts.push(`${board.slug} ${entries.length}`);

      for (const entry of entries) {
        // Rounded to whole points, which is what the board itself displays and what every
        // archived Elo row carries. The published interval is around ±6, so a decimal would be
        // precision the measurement does not have — and it would guarantee a diff every single
        // day, turning a live source into a source that rewrites its batch for no reason.
        const rating = Math.round(entry.rating);
        const key = `${board.slug}|${entry.name}`;
        byModel.set(key, {
          model_raw: entry.name,
          effort: effortOf(entry.name),
          maker: entry.organization || null,
          open_weights: null,
          context_k: null,
          intelligence_index: null,
          cost_per_task_usd: null,
          output_tokens_per_s: null,
          latency_first_chunk_s: null,
          // Never from this source. LM Arena publishes a price column with no tier and no region;
          // AGENTS.md keeps it out of price provenance and these nulls are what enforce that.
          price_input_per_m: null,
          price_output_per_m: null,
          price_cache_per_m: null,
          text_elo: board.field === "text_elo" ? rating : null,
          code_elo: board.field === "code_elo" ? rating : null,
          // The board publishes no evaluation date — an Elo is a running total, not a run. The
          // batch's retrievedDate is the honest freshness signal and the source card prints it.
          evaluation_date: null,
          source_label: board.label,
          source_url: board.page,
          source_kind: "independent",
          note:
            `对象：${board.label}，人类盲对比投票的 Elo，非任务准确率；` +
            `打分：${rating}（95% 区间 ${Math.round(entry.lower)}–${Math.round(entry.upper)}，${entry.votes} 票）` +
            (entry.organization ? `；发布方 ${entry.organization}` : ""),
        });
      }
    }

    const rows = [...byModel.values()];
    return {
      rows,
      version: "snapshot-latest",
      summary: `${rows.length} rows across ${BOARDS.length} boards (${counts.join(", ")})`,
      meta: {
        batch: "22 · LMArena human preference Elo",
        collectedWith: "scripts/fetchers/arena.mjs",
        filtered: false,
        sources: BOARDS.map((board) => board.page),
        schema:
          "Model operating parameters, NOT benchmark scores. Supplies text_elo and code_elo, the " +
          "only fields the catalog takes from LM Arena — and it no longer takes them by hand: " +
          "npm run ingest derives ARENA_ELO from this batch.",
        note:
          "Read from the boards' own server-rendered payload at arena.ai, which lmarena.ai now " +
          "redirects to. No browser and no key: the snapshot is embedded in the HTML as JSON. The " +
          "site's /api/ path answers 403 'Route not allowed', so the page is the published " +
          "artefact. Ratings are rounded to whole points — the board displays whole points, every " +
          "archived Elo row carries whole points, and the published interval is about ±6, so a " +
          "decimal would be precision the measurement does not have and would rewrite this batch " +
          "every day for nothing. One row per board per model, because a text Elo and a WebDev Elo " +
          "are two publications; the effort suffix is split off the display name using the same " +
          "closed list the archive already uses. inputPricePerMillion and outputPricePerMillion " +
          "are in the payload and are deliberately NOT read: LM Arena states no tier and no region, " +
          "so its price column cannot be reconciled with a vendor page, and these nulls are what " +
          "stop this batch from ever satisfying a price check. This board is live in the strongest " +
          "sense — an Elo moves with every vote — which is why the catalog no longer carries the " +
          "number at all.",
      },
    };
  },
};
