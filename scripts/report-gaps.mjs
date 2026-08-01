// Reports what the catalog is missing. This is the other half of npm run check:upstream:
// that job asks whether a number already archived has been edited at its source, this one
// asks what exists — upstream, or already in the archive — that the catalog has not taken in.
//
// Nothing here is a failure, so nothing here exits non-zero. A missing model is not a defect
// in the commit under review; it is a collection target. The output is a markdown report meant
// to be read weekly and turned into a batch, not a gate that turns CI red.
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
//   4. Which models has a provider published that the catalog has never heard of? Needs the
//      network, so it degrades to a note rather than failing when the feed is unreachable.

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
const { resolveModelId, isDropped } = buildResolvers(loadAliasConfig());
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
    if (resolveModelId(raw.model_raw, raw.reasoning_effort)) continue;
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
// the weekly job re-reads it — so everything listed is a manual re-transcription falling due.

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
    (scripted.has(entry.source.label) ? " (scripted — the weekly refresh should have covered this)" : ""),
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
    const catalogNeedles = [...Object.values(PROVIDER_LOOKUPS), ...MODELS.map((model) => model.id)];

    const cutoff = Date.now() / 1000 - sinceDays * 86400;
    const fresh = list
      .filter((item) => namespaces.has(item.id.split("/")[0]))
      .filter((item) => !variantOf(item.id))
      .filter((item) => !knownIds.has(item.id))
      .filter((item) => !catalogNeedles.some((needle) => item.id.toLowerCase().includes(needle)))
      .filter((item) => Number(item.created) > cutoff)
      .sort((a, b) => Number(b.created) - Number(a.created));

    say(
      `Watching ${namespaces.size} provider namespaces the catalog already resolves to ` +
        `(${[...namespaces].sort().join(", ")}), published in the last ${sinceDays} days.`,
    );
    say();

    if (fresh.length === 0) {
      say("Nothing new.");
    } else {
      clipped(fresh, (item) =>
        `- \`${item.id}\` — ${item.name ?? "unnamed"}, published ` +
        `${new Date(Number(item.created) * 1000).toISOString().slice(0, 10)}`,
      );
      say();
      gapCount += fresh.length;
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
