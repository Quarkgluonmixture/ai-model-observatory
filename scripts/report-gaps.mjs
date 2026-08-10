// Reports what the catalog is missing. This is the other half of npm run check:upstream:
// that job asks whether a number already archived has been edited at its source, this one
// asks what exists — upstream, or already in the archive — that the catalog has not taken in.
//
// Nothing here is a failure, so nothing here exits non-zero. A missing model is not a defect
// in the commit under review; it is a collection target. The output is a markdown report meant
// to be read on a schedule and turned into a batch, not a gate that turns CI red.
//
//   node --experimental-strip-types scripts/report-gaps.mjs [--since-days 60] [--no-network]
//
// Four questions, cheapest first:
//
//   1. Which models sit exactly one cell below a ranking floor? Purely local, and the highest
//      value per row collected: one observation moves a model from N/A into a lens.
//   2. Which archived rows are waiting on a catalog model? Also local. The evidence is already
//      transcribed; only a ModelRecord and an alias entry stand between it and the store.
//   3. Which sources has nobody re-read? Local. Eight of the ten batches are hand-transcribed
//      and cannot be diffed, so age is the only freshness signal they have.
//   4. Which models has a provider published that the catalog has never heard of, and for each
//      one, is it even a text model and is there anything in the archive waiting for it? Needs
//      the network, so it degrades to a note rather than failing when the feed is unreachable.
//      Questions 2 and 4 used to be printed as unrelated lists, and the join is the whole value:
//      "published upstream" says a lab shipped something, "rows waiting" says whether adding it
//      would fill any cells or draw an empty row across every column.

import {
  AXES,
  BENCHMARKS,
  MODELS,
  SOURCE_META,
  SOURCE_STALE_DAYS,
  OBSERVATION_ROWS,
  coreBenchmarksOf,
  portfolioCoverageOf,
  portfolioFloor,
} from "../app/model-data.ts";
import { FETCHERS } from "./fetchers/index.mjs";
import { PROVIDER_LOOKUPS } from "../app/api/live-models/route.ts";
import { buildResolvers, loadAliasConfig, readArchiveFiles } from "./lib/archive.mjs";
import { buildEvidenceIndex, dilutionFloor, sameFamily } from "./lib/upstream-evidence.mjs";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const sinceDays = Number(argOf("since-days", 60));
const TODAY = new Date().toISOString().slice(0, 10);
const useNetwork = !args.includes("--no-network");

// A report that lists everything is a report nobody reads, so each section states how many
// rows it left out rather than truncating silently.
const LIST_LIMIT = 20;
const out = [];
const say = (line = "") => out.push(line);
let gapCount = 0;

const clipped = (items, render) => {
  for (const item of items.slice(0, LIST_LIMIT)) say(render(item));
  if (items.length > LIST_LIMIT) say(`- … ${items.length - LIST_LIMIT} more, not listed`);
};

// Which benchmarks can actually still be collected, measured from the archive rather than
// declared. This is the difference between a target and a wish: the report ranks by how many
// models a cell would admit, and without this it would send an agent after cells that nobody
// publishes. A batch whose meta names a fetcher was collected by script; re-running it adds
// nothing until the source itself evaluates more models.
const { resolveModelId, isDropped, isRefused } = buildResolvers(loadAliasConfig());
const { batches } = readArchiveFiles();

const collectability = (() => {
  const scripted = new Map();
  const manual = new Map();
  const add = (map, key, value) => (map.get(key) ?? map.set(key, new Set()).get(key)).add(value);
  for (const { meta, rows } of batches) {
    const byScript = String(meta.collectedWith ?? "").startsWith("scripts/fetchers/");
    for (const { raw } of rows) {
      if (!raw.benchmark) continue;
      // The source label, not the batch name: what a person needs in order to decide whether
      // re-reading is worth it is which leaderboard the rows came off, not which batch filed them.
      add(byScript ? scripted : manual, raw.benchmark, raw.source_label ?? "unlabelled source");
    }
  }
  // Rows that never came from data/sources at all: the vendor comparison tables seeded directly
  // into app/model-data.ts. They are real evidence but they are not a source anyone can re-read.
  const seeded = new Set(
    OBSERVATION_ROWS.filter((row) => row.retrievedDate === undefined).map((row) => row.benchmarkId),
  );

  const few = (set) => {
    const all = [...set];
    return all.length <= 2 ? all.join(" / ") : `${all.slice(0, 2).join(" / ")} +${all.length - 2}`;
  };

  return (benchmarkId) => {
    if (scripted.has(benchmarkId)) {
      return {
        actionable: false,
        note: `already scripted (${few(scripted.get(benchmarkId))}) — the models missing it are absent upstream, not uncollected`,
      };
    }
    if (manual.has(benchmarkId)) {
      return { actionable: true, note: `transcribed from ${few(manual.get(benchmarkId))} — re-reading it may add models` };
    }
    if (seeded.has(benchmarkId)) {
      return {
        actionable: false,
        note: "only vendor seed rows in app/model-data.ts — no archived source to re-read; finding one is a collection project, not a fetch",
      };
    }
    return { actionable: false, note: "no observations anywhere — see docs/ARCHITECTURE.md §9 before hunting for a source" };
  };
})();

// --- 1. One cell below a ranking floor ------------------------------------------------
// The floor and the basket both come from app/model-data.ts, so this cannot drift from what
// the dashboard actually publishes.

say("## Models one observation short of a ranking");
say();

const unlocks = new Map();
const axisReports = [];

for (const axis of AXES) {
  const total = coreBenchmarksOf(axis.id, "system").length;
  if (!total) continue;
  const floor = portfolioFloor(total);

  const nearly = MODELS
    .map((model) => ({ model, ...portfolioCoverageOf(model.id, axis.id) }))
    .filter((entry) => entry.present === floor - 1)
    .sort((a, b) => a.model.name.localeCompare(b.model.name));

  for (const entry of nearly) {
    // With one cell to go, every missing benchmark is on its own a way in.
    for (const benchmark of entry.missing) {
      const key = `${benchmark.id}`;
      unlocks.set(key, (unlocks.get(key) ?? 0) + 1);
    }
  }

  if (nearly.length) axisReports.push({ axis, total, floor, nearly });
}

if (axisReports.length === 0) {
  say("No model is exactly one cell below a floor.");
} else {
  for (const { axis, total, floor, nearly } of axisReports) {
    say(`### ${axis.en} — floor ${floor} of ${total} core cells`);
    say();
    clipped(nearly, (entry) =>
      `- **${entry.model.name}** has ${entry.present}/${total}; any one of: ` +
      entry.missing.map((benchmark) => `\`${benchmark.id}\``).join(", "),
    );
    say();
    gapCount += nearly.length;
  }

  // Sorted by what can actually be done, not by what would be worth the most. Ranking purely by
  // reach put four benchmarks nobody publishes at the top of this list, which is precisely the
  // instruction an unattended agent should never be given.
  const ranked = [...unlocks]
    .filter(([, count]) => count > 1)
    .map(([benchmarkId, count]) => ({ benchmarkId, count, ...collectability(benchmarkId) }))
    .sort((a, b) => (b.actionable ? 1 : 0) - (a.actionable ? 1 : 0) || b.count - a.count);

  const doable = ranked.filter((entry) => entry.actionable);
  const blocked = ranked.filter((entry) => !entry.actionable);
  const line = (entry) => {
    const benchmark = BENCHMARKS.find((record) => record.id === entry.benchmarkId);
    return `- \`${entry.benchmarkId}\` (${benchmark?.name ?? "unknown"}) would admit ${entry.count} models — ${entry.note}`;
  };

  if (doable.length) {
    say("**Worth collecting** — one benchmark, several models admitted, and a path to the data:");
    say();
    clipped(doable, line);
    say();
  }
  if (blocked.length) {
    say(
      "**High reach, no path.** These would admit the most models and are listed so nobody " +
        "re-derives them as targets — the cells are empty because the source has not published " +
        "them, not because they were never collected:",
    );
    say();
    clipped(blocked.slice(0, 8), line);
    say();
  }
}

// --- 2. Archived evidence with no catalog model ---------------------------------------
// These rows are already transcribed and sitting in data/sources. They cost nothing to
// collect — only a ModelRecord and an alias entry. Which batch a string appears in is the
// triage signal: a string in the current LiveBench release is a live model, while one that
// only appears in an older transcription is almost always previous-generation.

say("## Archived rows waiting on a catalog model");
say();

const waiting = new Map();
for (const { file, rows } of batches) {
  for (const { raw } of rows) {
    if (isDropped(raw.benchmark)) continue;
    if (resolveModelId(raw.model_raw, raw.reasoning_effort, file)) continue;
    // A per-file refusal is a decision already made, not an uncollected model. Listing it here
    // would put a permanent, un-actionable line in the gaps issue every release.
    if (isRefused(raw.model_raw, raw.reasoning_effort, file)) continue;
    const entry = waiting.get(raw.model_raw) ?? { rows: 0, files: new Set() };
    entry.rows += 1;
    entry.files.add(file.replace(/\.jsonl$/, ""));
    waiting.set(raw.model_raw, entry);
  }
}

const waitingList = [...waiting]
  .map(([modelRaw, entry]) => ({ modelRaw, rows: entry.rows, files: [...entry.files].sort() }))
  .sort((a, b) => b.rows - a.rows);

if (waitingList.length === 0) {
  say("Every archived row resolves to a catalog model.");
} else {
  const totalRows = waitingList.reduce((sum, entry) => sum + entry.rows, 0);
  say(
    `${totalRows} rows across ${waitingList.length} published model strings. Most are ` +
      "previous-generation and deliberately untracked — the batch column is the triage signal.",
  );
  say();
  clipped(waitingList, (entry) =>
    `- \`${entry.modelRaw}\` — ${entry.rows} rows (${entry.files.join(", ")})`,
  );
  say();
}

// --- 3. Sources nobody has re-read ----------------------------------------------------
// The dashboard already marks these amber, but a marker on section 06 is only seen by someone
// who scrolls to section 06. A source that can be re-read by script never appears here, because
// the scheduled job re-reads it — so everything listed is a manual re-transcription falling due.

say("## Sources going stale");
say();

const scripted = new Set(FETCHERS.map((fetcher) => fetcher.label));
const cutoff = new Date(Date.parse(TODAY) - SOURCE_STALE_DAYS * 86400000).toISOString().slice(0, 10);

const aging = Object.values(SOURCE_META)
  .map((source) => ({ source, iso: source.lastRetrieved ?? source.lastEvaluated }))
  .filter((entry) => entry.iso && entry.iso < cutoff)
  .sort((a, b) => a.iso.localeCompare(b.iso));

if (aging.length === 0) {
  say(`Every source with rows behind it has been read since ${cutoff}.`);
} else {
  say(`Not read since ${cutoff} (${SOURCE_STALE_DAYS} days):`);
  say();
  clipped(aging, (entry) =>
    `- **${entry.source.label}** — ${entry.source.lastRetrieved ? "read" : "evaluated"} ` +
    `${entry.iso}, ${entry.source.observations} row${entry.source.observations === 1 ? "" : "s"}` +
    (scripted.has(entry.source.label) ? " (scripted — the scheduled refresh should have covered this)" : ""),
  );
  say();
  gapCount += aging.length;
}

// --- 4. Published upstream, absent from the catalog -----------------------------------
// The labs to watch are not declared, they are measured: whichever provider namespaces the
// catalog's own models resolve to on OpenRouter are the ones worth diffing. Declaring a list
// of provider slugs would be a guess, and a guess that goes stale the day a lab is added.

say("## Published upstream, absent from the catalog");
say();

const variantOf = (id) => id.includes(":"); // ":free", ":thinking" — an operating point, not a model

// A pricing or service tier is not a model either, and it arrives in a shape `variantOf` cannot
// see: OpenRouter publishes `Claude Opus 5 (batch)` and `Claude Opus 5 (Fast)` as separate entries
// whose tier lives in `name`, not after a colon in `id`. AGENTS.md rule 7 puts an operating point
// in `configurations`; a record of its own would enter every ranking as a second copy of a model
// the catalog already carries.
//
// The keyword list is closed and deliberately short, because the cost of a wrong entry here is a
// real model going unreported. `preview` is NOT on it — the catalog carries `Gemini 3.1 Pro
// Preview` and `Qwen3.6 Max Preview` as records of their own, since a preview is different weights
// while a batch tier is the same weights at a different price. Nor are `lite`, `mini` or `flash`:
// those are models. Measured on 2026-08-10, when five of the eight names in this section were
// `(batch)` or `(Fast)` and carried zero archived rows between them.
const TIER_WORDS = new Set(["batch", "fast", "flex", "priority", "standard", "scale"]);
const tierOf = (item) => {
  const match = /\(([^()]+)\)\s*$/.exec(item.name ?? "");
  if (!match) return null;
  const word = match[1].trim().toLowerCase();
  return TIER_WORDS.has(word) ? word : null;
};

// An image generator is not a candidate for this catalog, and the feed says so outright:
// `architecture.output_modalities`. Measured 2026-08-07 — Nano Banana 2, Nano Banana 2 Lite and
// Nano Banana Pro all publish ["image","text"], while Muse Spark 1.2 and Qwen3.7 Flash publish
// ["text"]. So this is a field lookup, not a judgement, and it belongs here rather than in a
// reader's head: those three sat in this list for weeks as things somebody had to rule out by
// name every time. Input modality is deliberately NOT filtered on — every current flagship
// accepts images, and a text model that reads pictures is still a text model.
const textOnly = (item) => {
  const out = item?.architecture?.output_modalities;
  if (!Array.isArray(out) || out.length === 0) return null;   // unknown shape: report, do not hide
  return out.every((modality) => modality === "text");
};

// How many archived rows are waiting for this model, and how many cells a record would fill —
// `scripts/lib/upstream-evidence.mjs`, which is also where the four reasons a row is not a cell
// live. Kept there rather than here because that number is what decides whether a record should be
// written at all, and a second copy would drift into disagreeing with this one about which models
// are worth collecting. Run it with `--self-test`.
//
// That self-test is a gate as of 2026-08-10 and runs in CI. Before that it always exited 0, and the
// numbers quoted here — "89% mean recovery, 0 over-counts" — had silently become 70% and 1 without
// anybody noticing, which is the whole argument for wiring it up. No percentage is repeated here on
// purpose: run the self-test, do not trust a number copied into a comment.
//
// The one over-count is pinned there with its reason: `deepseek-v4-flash` / `ifbench`. One AA slug
// carries the 0731 release and the April preview, separated by `reasoning_effort`; `ingest` uses that
// field and attributes both correctly, while this counter strips effort by design — which is what
// lets it work for a model that has no alias yet. A NEW over-count fails CI, and that matters
// because this counter decides whether a model clears the dilution floor and
// `scripts/add-model-and-merge.sh` merges on that number.
const lookupEvidence = buildEvidenceIndex(BENCHMARKS.map((benchmark) => benchmark.id));
const evidenceFor = (item) => lookupEvidence([item.id.split("/").slice(1).join("/"), item.name ?? ""]);

// The cells a model must bring to avoid lowering coverage. Arithmetic on the current board rather
// than a policy, recomputed every run because it moves as the board fills.
const floor = dilutionFloor(
  Object.values(OBSERVATION_ROWS.reduce((cells, row) => {
    (cells[row.modelId] ??= new Set()).add(row.benchmarkId);
    return cells;
  }, {})).reduce((total, set) => total + set.size, 0),
  MODELS.length,
)

if (!useNetwork) {
  say("Skipped: --no-network.");
} else {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const payload = await response.json();
    const list = Array.isArray(payload?.data) ? payload.data : [];
    if (list.length === 0) throw new Error("the feed returned no models");

    const upstreamIds = new Set(list.map((item) => item.id.toLowerCase()));
    const matched = new Map(
      Object.entries(PROVIDER_LOOKUPS).filter(([, providerId]) => upstreamIds.has(providerId)),
    );

    // Which labs to watch is measured, not declared: the namespaces the catalog's own lookups
    // resolve into. A hand-written list of provider slugs would go stale the day a lab is added.
    const namespaces = new Set([...matched.values()].map((id) => id.split("/")[0]));
    const knownIds = new Set(matched.values());
    // Names the catalog already understands. Catalog ids count too, not just the lookup table:
    // a model the catalog carries but has no price lookup for is a missing lookup, not a
    // missing model, and must not be reported as new.
    //
    // ⚠ This used to ask `item.id.includes(needle)`, and a substring test cannot tell a family from
    // a longer name that contains it. `google/gemini-3.5-flash-lite` contains `gemini-3.5-flash`, so
    // for as long as the catalog carried Flash, this report was **blind to Flash Lite** — 33 cells of
    // archived evidence, silently filed as "already carried". Measured 2026-08-10. It is the same
    // failure the price lookups were made exact for (AGENTS.md: `includes("gpt-5.6")` returned
    // `gpt-5.6-luna-pro` and rendered the wrong price), in a second file, and worse here because a
    // false negative is invisible — a noisy line gets read, a missing line does not.
    //
    // `sameFamily` is the module's own rule, imported rather than re-implemented: the family itself,
    // or the family at a published operating point, and nothing else. A tier (`-fast`) is not an
    // operating point, so a tier now reaches the tier group below and is named there with a reason,
    // instead of vanishing behind this filter for the wrong reason.
    const catalogNeedles = [...Object.values(PROVIDER_LOOKUPS), ...MODELS.map((model) => model.id)]
      // The lookup table is namespaced (`anthropic/claude-opus-5`) and catalog ids are not, and the
      // comparison below is against the id's tail, so both are reduced to that shape once here.
      .map((needle) => needle.split("/").slice(-1)[0]);

    const cutoff = Date.now() / 1000 - sinceDays * 86400;
    const candidates = list
      .filter((item) => namespaces.has(item.id.split("/")[0]))
      .filter((item) => !variantOf(item.id))
      .filter((item) => !knownIds.has(item.id))
      .filter((item) => !catalogNeedles.some((needle) => sameFamily(item.id.split("/").slice(1).join("/"), needle)))
      .filter((item) => Number(item.created) > cutoff)
      .sort((a, b) => Number(b.created) - Number(a.created));

    const images = candidates.filter((item) => textOnly(item) === false);
    const textish = candidates.filter((item) => textOnly(item) !== false);

    // Three different things used to share one list, and a reader had to re-sort them by hand every
    // morning: a model worth collecting, a model with nothing behind it yet, and a pricing tier that
    // must never get a record at all. Eight names on 2026-08-10 were two of the first and six of the
    // other two, which is how a report that never fails trains its reader to skim it.
    //
    // The tier test is deliberately a CONJUNCTION — a tier keyword *and* an empty archive. A
    // `(batch)` entry that somehow has archived cells stays in the queue for a person to look at,
    // because the expensive mistake here is silently dropping a real model, not carrying one extra
    // line. Same reason the image count below is printed rather than filtered away.
    const withEvidence = textish.map((item) => ({ item, evidence: evidenceFor(item) }));
    const tiers = withEvidence.filter((entry) => tierOf(entry.item) && entry.evidence.rows === 0);
    const rest = withEvidence.filter((entry) => !tiers.includes(entry));
    // Closest to clearing the floor first. Date order put the newest name on top, which is not the
    // same as the one worth collecting.
    const queue = rest
      .filter((entry) => entry.evidence.rows > 0)
      .sort((a, b) => b.evidence.cells.length - a.evidence.cells.length);
    const unbacked = rest.filter((entry) => entry.evidence.rows === 0);

    say(
      `Watching ${namespaces.size} provider namespaces the catalog already resolves to ` +
        `(${[...namespaces].sort().join(", ")}), published in the last ${sinceDays} days. ` +
        `A model needs **more than ${floor} filled cells** to not lower cell coverage — ` +
        `that is the current average, recomputed each run, not a policy.`,
    );
    say();
    say(
      `Of ${textish.length} text model(s) upstream that the catalog does not carry: ` +
        `**${queue.length} have archived evidence** and are the queue below; ` +
        `${unbacked.length} have nothing waiting for them; ` +
        `${tiers.length} are pricing or service tiers of a model, not models. ` +
        "Only the first group is counted as a gap.",
    );
    say();

    if (queue.length === 0) {
      say("Nothing upstream has archived evidence waiting for it.");
      say();
    } else {
      clipped(queue, ({ item, evidence }) => {
        const date = new Date(Number(item.created) * 1000).toISOString().slice(0, 10);
        const modality = textOnly(item) === null ? " · ⚠ feed states no output modality" : "";
        // Both numbers are lower bounds, and saying so is the point: a source spelling the model
        // differently enough to survive `norm` is not counted, so "below the floor" is a claim
        // this can make and "above the floor" is a candidate rather than a verdict.
        //
        // The shortfall is `floor + 1 - cells`, not `floor - cells`, because clearing the floor
        // means *more than* the average — an off-by-one worth spelling out, since this number is
        // the one a reader uses to decide what to collect next.
        const verdict = evidence.cells.length > floor
          ? `at least ${evidence.rows} archived row(s) filling at least ${evidence.cells.length} catalog cell(s)` +
            ` — clears the ${floor}-cell floor, worth drafting with \`npm run draft:model\``
          : `at least ${evidence.rows} archived row(s) filling at least ${evidence.cells.length} catalog cell(s)` +
            ` — **needs ${floor + 1 - evidence.cells.length} more cell(s)** to clear the ${floor}-cell floor;` +
            " a record today would still lower coverage";
        return `- \`${item.id}\` — ${item.name ?? "unnamed"}, published ${date}${modality}\n` +
          `  ${verdict}${evidence.parameters ? " (operating parameters are archived)" : ""}` +
          (evidence.cells.length ? `\n  cells it would fill: ${evidence.cells.sort().join(", ")}` : "");
      });
      say();
      gapCount += queue.length;
    }

    // The two non-queue groups are counts with their names inline, never `- \`id\`` bullets:
    // `scripts/publish-gaps-issue.sh` reads that bullet shape out of this section to tell a model
    // that appeared today from one that has been sitting here a week, and neither of these is a
    // model queued for collection. The `images` paragraph below has always worked this way.
    if (unbacked.length) {
      const named = unbacked
        .map(({ item, evidence }) => "`" + item.id + "`" + (evidence.parameters ? " (parameters archived)" : ""))
        .join(", ");
      say(
        `${unbacked.length} published upstream with **nothing in the archive waiting** ` +
          `(${named}). A record today draws an empty row across every column, so these wait for a ` +
          "source to evaluate them rather than for somebody to type them in.",
      );
      say();
    }

    if (tiers.length) {
      say(
        `${tiers.length} are a **pricing or service tier**, not a model ` +
          `(${tiers.map(({ item }) => "`" + item.id + "` (" + tierOf(item) + ")").join(", ")}). ` +
          "Same weights at a different price: they belong in `configurations` or a batch meta, never " +
          "in a catalog record of their own (AGENTS.md rule 7). Matched on a closed keyword list " +
          "**and** an empty archive, so a tier that turns out to carry evidence stays in the queue " +
          "above instead of disappearing here.",
      );
      say();
    }

    // Reported as a count and not as a list. They are not work, and naming them every day is how
    // a reader ends up re-deciding a settled question — but a silent filter is how a text model
    // gets dropped by a mis-set field, so the number stays visible.
    if (images.length) {
      say(
        `${images.length} more published in these namespaces output images ` +
          `(${images.map((item) => "`" + item.id + "`").join(", ")}) and are not candidates for a ` +
          "capability catalog. Filtered on `architecture.output_modalities`, not on the name.",
      );
      say();
    }

    // A lookup naming an id the provider no longer serves resolves to nothing, and nothing is
    // silent: the price card simply keeps its archived figure with no comparison beside it.
    const dead = Object.entries(PROVIDER_LOOKUPS).filter(([, providerId]) => !upstreamIds.has(providerId));
    if (dead.length) {
      say(`${dead.length} live-price lookups name an id the provider no longer serves:`);
      say();
      clipped(dead, ([modelId, providerId]) => `- \`${modelId}\` → \`${providerId}\` (gone)`);
      say();
      gapCount += dead.length;
    }

    // A catalog model with no lookup at all can never take a comparison, which is the same
    // silence from the other direction. Split the list: only one half is actionable.
    const unlinked = MODELS.filter((model) => !(model.id in PROVIDER_LOOKUPS));
    const servedUpstream = unlinked
      .map((model) => ({ model, upstream: list.find((item) => item.id.toLowerCase().includes(model.id)) }))
      .filter((entry) => entry.upstream);
    const notServed = unlinked.filter((model) => !servedUpstream.some((entry) => entry.model.id === model.id));

    if (servedUpstream.length) {
      say(
        `${servedUpstream.length} catalog models look served upstream but have no entry in ` +
          "`PROVIDER_LOOKUPS`, so their price is never checked against a provider:",
      );
      say();
      clipped(servedUpstream, (entry) => `- \`${entry.model.id}\` — candidate \`${entry.upstream.id}\` (confirm the exact id before adding)`);
      say();
      gapCount += servedUpstream.length;
    }
    if (notServed.length) {
      say(
        `${notServed.length} carry no live comparison because no watched provider serves them: ` +
          `${notServed.map((model) => `\`${model.id}\``).join(", ")}.`,
      );
      say();
    }
  } catch (error) {
    // A price feed being down is not a collection gap, and must not read like one.
    say(`Unavailable: ${error.message}. This section needs the network; the rest of the report does not.`);
    say();
  }
}

say(`<!-- gaps: ${gapCount} -->`);
process.stdout.write(out.join("\n") + "\n");
