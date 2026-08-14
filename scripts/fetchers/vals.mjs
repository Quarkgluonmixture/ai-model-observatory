// Vals AI, read from the props its own leaderboard components are rendered with.
//
// §9 recorded Vals as publishing nothing machine-readable, twice. That verdict was a claim about
// the search, and this is the eighth of them to be overturned. Two things had hidden it:
//
//   /benchmarks is an INDEX, not a board. It has no table and no scores, which is what both
//     earlier passes measured. Every actual leaderboard is at /benchmarks/<slug>.
//   Those pages are Astro, and Astro server-renders a component's props into a `props="…"`
//     attribute on <astro-island>. So the whole board is in the HTML — 1.16MB of it for
//     CorpFin v2 — but it is HTML-escaped JSON in an attribute, not a <table>, so every check
//     for `<tr>`, `<table>`, `fetch(` or an `/api/` path answers no. There is nothing to find in
//     the JavaScript chunks because the data never travels separately from the page.
//
// One board now breaks that second sentence, and it is why the loop below skips instead of
// throwing when a board with no catalog column has no island: `rsi_index` (first seen
// 2026-08-14) is a client-only React component whose whole dataset — 3 models, 5 research
// tasks, `score` 0-1, no `overall` — is bundled inside its JS chunk, `props="{}"`. Boards that
// map to a catalog column still hard-fail on a missing island, because that is a restyle of a
// board this project publishes.
//
// What licensed replacing the transcription: batch 05 hand-read six CorpFin v2 rows —
// 73.19 / 71.83 / 71.56 / 71.29 / 68.57 / 68.53 — and this file's `overall` task gives
// 73.194 / 71.834 / 71.562 / 71.29 / 68.57 / 68.532 for the same six models. Six of six, so
// `overall` is the view the board shows by default and the one that was transcribed.
//
// The other task views are NOT other readings of that number. CorpFin's `exact_pages`,
// `max_fitting_context` and `shared_max_context` are three different context conditions of the
// same questions, and LegalBench's `issue_tasks` / `rule_tasks` are subsets. Ingesting them
// beside `overall` would put one model's condition against another's in one column, which rule 4
// forbids — so only `overall` is read, except where batch 05 deliberately recorded a named
// sub-task as its own column (CyberBench's poc/patch, Web Search's finance/legal), which is
// carried below as an explicit map rather than as a rule.

import { unwrapAstroProps, readAstroIslandProps } from "../lib/astro-props.mjs";

const SITE = "https://www.vals.ai";
const INDEX = `${SITE}/benchmarks`;

// Vals slug -> the benchmark string this project already uses for that board, taken from the
// `source_url` on batch 05's own rows so the two readings land in the same column. A board that is
// not here gets `vals-<slug>`, which resolves to no catalog column and is refused at ingest with a
// reason — see `droppedBenchmarks`. That is deliberate: a new column is a taxonomy decision, and
// collecting the rows now means the decision costs no re-collection later.
const KNOWN_ENTRIES = [
  ["corp_fin_v2", "vals-corpfin"],
  ["fabv2", "vals-finance-agent"],
  ["legal_research", "vals-legal-research"],
  ["medscribe", "vals-medscribe"],
  ["mortgage_tax", "vals-mortgage-tax"],
  ["public-benefits-bench", "vals-public-benefits"],
  ["skillsbench", "vals-skillsbench"],
  ["lcb", "vals-livecodebench"],
  ["ioi", "vals-ioi"],
  ["code-migration", "vals-code-migration"],
  ["vibe-code", "vals-vibe-code-bench"],
  ["proof_bench", "vals-proofbench"],
  // These five are Vals running somebody else's benchmark. `benchmarkAliases` already routes each
  // to the shared column, as an independent evaluation rather than a benchmark-native one — and
  // that is exactly why they are marked `shared`. See `benchmarkVersion` below.
  ["gpqa", "vals-gpqa-diamond", "shared"],
  ["mmmu", "vals-mmmu-pro", "shared"],
  ["mmlu_pro", "vals-mmlu-pro", "shared"],
  ["swebench", "vals-swe-bench-verified", "shared"],
  ["terminal-bench-2-1", "vals-terminal-bench-2-1", "shared"],
  ["terminal-bench-2", "vals-terminal-bench-2", "shared"],
  // Meta's ProgramBench, not a namesake. The check: Vals' board description and the repository's
  // own GitHub description are the same sentence — "Can Language Models Rebuild Programs From
  // Scratch?" — which is exactly the check that was missing when a namesake last got through here
  // (ALE-Bench and Agents' Last Exam share three letters and nothing else).
  ["programbench", "vals-programbench", "shared"],
  // Vals' own composites. Mapped to the string the archive already refuses rather than left to
  // arrive under a new one, because the reason has not changed: they average the sub-benchmarks
  // this batch ingests individually, so carrying them would double-count.
  ["vals_index", "vals-index"],
  ["vals_multimodal_index", "vals-multimodal-index"],
];
const KNOWN = new Map(KNOWN_ENTRIES.map(([slug, benchmark]) => [slug, benchmark]));

// Vals' `version` is the version of **Vals' own board**, not of the benchmark it ran. On its own
// benchmarks the two are the same thing and the field is the right one to record: CorpFin v2 is
// CorpFin v2. On somebody else's it is not — Vals calls its GPQA Diamond board `1` and its
// SWE-bench board `1`, which say nothing about which GPQA or which SWE-bench split those are, and
// writing them into the shared column put `v2.1` beside the `2.1` already there and failed
// check:data for mixing versions in one cell. So a shared column gets null and inherits the
// column's own version, which is what batch 05 recorded for the same five boards.
//
// A bare `1` is dropped for the same reason one step further: it does not mean "version 1 of the
// question set", it means Vals has never revised this board. Writing it collides with the label
// the column already declares — `vals-ioi` and `vals-skillsbench` declare `2026`,
// `vals-livecodebench` declares LiveCodeBench's own `v6` — and check:data fails on a cell holding
// two version strings. Anything Vals has actually revised (`2`, `1.1`, `1.2`) is real and is kept.
//
// The rule reproduces batch 05's transcription exactly: it recorded `v2` for CorpFin and Finance
// Agent, `v1.1` for Public Benefits and Vibe Code, and null everywhere else.
//
// A shared column is listed here explicitly rather than blanket-nulled, because null is NOT free:
// `ingest` drops a row that has neither a published version nor a `versionFallbacks` entry, and it
// says so in its skip report. `terminal` has no fallback, so nulling it silently deleted all 50 of
// Vals' Terminal-Bench rows from the store while every contract stayed green — the archive had
// them, the board did not. Terminal-Bench 2.1 is a real benchmark version and is carried as `2.1`,
// unprefixed, which is how the column already spells it.
const SHARED_VERSION = new Map([
  ["terminal-bench-2-1", "2.1"],
  // Terminal-Bench 2.0 is a different question set from 2.1 and the catalog keeps it in its own
  // `terminal-20` column; `benchmarkSplits` does that routing off this exact version string.
  ["terminal-bench-2", "2.0"],
  // ProgramBench publishes no version. The `program` column declares 2026 and a `versionFallbacks`
  // entry supplies it — see data/model-aliases.json for why that is safe here and was not before.
  ["programbench", null],
  // The other four publish no version of the underlying benchmark, and each has a
  // `versionFallbacks` entry naming its split — Diamond, Pro, Verified — which is the label a
  // reader can check. `mmlu_pro` has neither, which is why the catalog's `mmlu-pro` column is
  // still empty; batch 05's rows were dropped for the same reason and this changes nothing there.
  ["gpqa", null],
  ["mmmu", null],
  ["mmlu_pro", null],
  ["swebench", null],
]);
const benchmarkVersion = (slug, meta) => {
  if (SHARED_VERSION.has(slug)) return SHARED_VERSION.get(slug);
  if (!meta.version || String(meta.version) === "1") return null;
  return `v${meta.version}`;
};

// The two boards batch 05 read by sub-task instead of by `overall`, because on these the overall
// figure is an average across conditions the catalog keeps apart. Written out per board rather
// than inferred, so adding a third is a visible edit.
const SUBTASKS = new Map([
  ["cyber", [["poc", "vals-cyberbench-poc"], ["patch", "vals-cyberbench-patch"]]],
  ["web_search", [
    ["overall", "vals-web-search-index"],
    ["finance", "vals-web-search-index-finance"],
    ["legal", "vals-web-search-index-legal"],
  ]],
]);

const fetchText = async (url) => {
  const response = await fetch(url, {
    // Vals answers a bare programmatic client with an empty body on some paths; the site is
    // public and this is the same request a reader's browser makes.
    headers: { "user-agent": "Mozilla/5.0 (compatible; ai-model-observatory)" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  return response.text();
};

export const vals = {
  id: "vals",
  label: "Vals AI",
  batch: "batch-29-vals",

  // Live, not append-only, and the reason is the shape of the source rather than a preference.
  // An append-only source has ONE frozen version to re-read at, and this batch holds 37 boards
  // with 37 of their own (`v1`, `v2`, `v1.1`, `v2.1`) — `archiveVersion` has no single answer to
  // give. Vals also re-runs continuously: every board carries its own `updated`, and the ones
  // read on 2026-08-09 span 2025-12-23 to 2026-08-06. So a moved number is Vals re-running, which
  // reaches a pull request with `describe-change` naming every published figure that moved, and
  // the three-condition gate refuses to merge it unattended. The trade is explicit: a rewritten
  // Vals number arrives as a PR rather than as a red job.
  versioning: "live",

  async fetch() {
    const index = await fetchText(INDEX);
    const slugs = [...new Set([...index.matchAll(/href="\/benchmarks\/([a-z0-9_-]+)"/g)].map((m) => m[1]))].sort();
    if (slugs.length === 0) throw new Error(`no /benchmarks/<slug> links on ${INDEX} — the index changed shape`);

    const rows = [];
    const collected = [];
    const noColumn = [];
    const noIsland = [];

    for (const slug of slugs) {
      const html = await fetchText(`${SITE}/benchmarks/${slug}`);
      const props = readAstroIslandProps(html, "benchmarkView");
      if (!props) {
        // A board that maps to a catalog column and has lost its island is a restyle, and
        // writing the batch without it would silently drop a published column. That stays a
        // hard error — this is the alarm that fires the day Vals rebuilds the boards we show.
        if (KNOWN.has(slug) || SUBTASKS.has(slug)) {
          throw new Error(`${slug}: no benchmarkView island — the page changed shape`);
        }
        // A board with no catalog column cannot silently drop one: it would land under
        // `vals-<slug>` and be refused at ingest anyway. Skip it and name it in the meta,
        // so the batch says what it did not read. The first such board is `rsi_index`
        // (seen 2026-08-14, the run whose whole-source failure this branch replaces): Vals
        // built it as a client-only React component whose data is bundled inside the JS
        // chunk rather than server-rendered into props, and it is not the same kind of board
        // either — 3 models, 5 research tasks (compression, lm_training, …), `score` 0-1,
        // no `overall`. Collecting it is a taxonomy decision away, not a fetch away: the day
        // a column wants it, the hard branch above fires and forces the parser to learn its
        // shape instead of skipping past it.
        noIsland.push(slug);
        continue;
      }
      const view = unwrapAstroProps(props);
      const board = view.benchmarkView?.default ?? view.benchmarkView;
      const meta = board?.metadata ?? {};
      const tasks = board?.tasks ?? {};

      const wanted = SUBTASKS.get(slug) ?? [["overall", KNOWN.get(slug) ?? `vals-${slug}`]];
      if (!KNOWN.has(slug) && !SUBTASKS.has(slug)) noColumn.push(`${slug} (${meta.benchmark ?? "?"})`);

      for (const [task, benchmark] of wanted) {
        const entries = tasks[task];
        if (!entries) throw new Error(`${slug}: no "${task}" task — it publishes ${Object.keys(tasks).join(", ")}`);
        let kept = 0;
        for (const [published, cell] of Object.entries(entries)) {
          const score = Number(cell?.accuracy);
          if (!Number.isFinite(score)) continue;
          rows.push({
            // Verbatim, `provider/model` as Vals publishes it. Which catalog model this is stays
            // the alias step's decision — the same call batch 23 made for ARC's ids, and the
            // opposite of folding the provider away here and guessing.
            model_raw: published,
            benchmark,
            benchmark_version: benchmarkVersion(slug, meta),
            score: Number(score.toFixed(3)),
            unit: "%",
            harness: cell.harness ?? null,
            reasoning_effort: cell.reasoning_effort ?? null,
            tools_enabled: null,
            context_length: null,
            // Vals publishes an `updated` date per BOARD, not a run date per row. Writing the
            // board's date onto every row would date a model's result with the day some other
            // model was added, which is the same fabrication epoch.mjs refuses for release dates.
            // The board date is in the note and in the batch meta instead.
            evaluation_date: null,
            source_label: `Vals AI · ${meta.benchmark ?? slug}${task === "overall" ? "" : ` · ${meta.tasks?.[task] ?? task}`}`,
            source_url: `${SITE}/benchmarks/${slug}`,
            // Vals is a third party running its own and other people's benchmarks. Even on its own
            // private sets it is an independent evaluator by this project's taxonomy, which
            // reserves `benchmark` for the board a benchmark's own authors publish.
            source_kind: "independent",
            note:
              `对象：Vals AI ${meta.dataset_type === "private" ? "私有" : "公开"}题集 ${meta.benchmark ?? slug}` +
              (task === "overall" ? "" : ` 的 ${meta.tasks?.[task] ?? task} 子项`) +
              `；打分：准确率 0-100` +
              (meta.mode ? `；${meta.mode}` : "") +
              (cell.stderr == null ? "" : `；标准误 ±${cell.stderr}`) +
              (cell.cost_per_test == null ? "" : `；每题成本 $${cell.cost_per_test}`) +
              (cell.latency == null ? "" : `；延迟 ${cell.latency}s`) +
              (meta.updated ? `；该板最后更新 ${meta.updated}` : ""),
          });
          kept += 1;
        }
        collected.push(`${benchmark} ${kept}`);
      }
    }

    // Stable order so a re-read that adds one model is a one-line diff.
    rows.sort((a, b) =>
      a.benchmark.localeCompare(b.benchmark) || b.score - a.score || a.model_raw.localeCompare(b.model_raw));

    // The skip above is per-board and bounded by it; a fetch that read NOTHING means every
    // board restyled at once, and letting it through would let the next `--live` refresh
    // rewrite this batch empty. 40+ boards going dark together is a restyle, not an empty site.
    if (rows.length === 0) throw new Error(`read ${slugs.length} boards and collected nothing — the pages changed shape`);

    return {
      rows,
      version: `${slugs.length} boards`,
      summary:
        `${rows.length} rows across ${collected.length} board view(s) from ${slugs.length} boards` +
        (noIsland.length ? `; ${noIsland.length} unreadable board(s) skipped: ${noIsland.join(", ")}` : ""),
      meta: {
        batch: "29 · Vals AI",
        collectedWith: "scripts/fetchers/vals.mjs",
        filtered: true,
        filterRule:
          "Every board Vals links from /benchmarks, one row per model on its `overall` task — plus " +
          "the named sub-tasks batch 05 recorded as their own columns (CyberBench poc/patch, Web " +
          "Search finance/legal). Every OTHER sub-task is deliberately not read: they are " +
          "conditions and subsets of the same questions (CorpFin's three context settings, " +
          "LegalBench's five task types, MGSM's twelve languages), and beside `overall` they would " +
          "put one model's condition against another's in one column. Boards with no catalog " +
          "column yet are collected under `vals-<slug>` and refused at ingest with a reason, so " +
          "adding the column later costs no re-collection: " +
          (noColumn.length ? noColumn.join(", ") : "none") +
          ". Boards whose page carries no server-rendered board at all — a client-only component " +
          "with the data bundled in its JS chunk — are skipped and named here rather than allowed " +
          "to fail the whole source; they have no catalog column, so nothing published depends " +
          "on them: " +
          (noIsland.length ? noIsland.join(", ") : "none"),
        release: "rolling",
        sources: [INDEX, ...slugs.map((slug) => `${SITE}/benchmarks/${slug}`)],
        note:
          "Read from the `props` attribute Astro server-renders onto each board's <astro-island>, " +
          "which is where the whole leaderboard lives — /benchmarks is an index with no scores, " +
          "and that page is what two earlier passes measured before recording Vals as publishing " +
          "nothing machine-readable. score is the published `accuracy` (already 0-100). harness " +
          "and reasoning_effort come from the row's own fields rather than from prose. " +
          "evaluation_date is null on every row on purpose: Vals dates the BOARD, not the run. " +
          "model_raw is the published `provider/model` string, verbatim — attribution stays the " +
          "alias step's decision. source_kind is independent throughout: Vals is a third party " +
          "even on the private sets it owns, which this project distinguishes from a board a " +
          "benchmark's own authors publish.",
      },
    };
  },
};
