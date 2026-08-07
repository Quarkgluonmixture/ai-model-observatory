// ARC Prize's verified leaderboard, read from the file the page loads.
//
// The path is not in the Next.js chunk. `/leaderboard` renders client-side, its page chunk is 6KB
// with no `fetch(` in it, and the HTML carries no model names — read only those two and you
// conclude this board cannot be scripted, which is what `docs/ARCHITECTURE.md` §9 concluded. The
// data is loaded by `/scripts/leaderboard/data.js`, a plain script the page includes, through four
// `d3.json()` calls: evaluations, models, datasets, providers.
//
// ## This is the first-hand source both archived copies descend from
//
// Verified on 2026-08-07 against models the catalog already carried, which is the check AGENTS.md
// requires before trusting any new source:
//
//   anthropic-opus-4-8-{low,medium,high}                      62.22 / 71.67 / 72.08
//   gpt-5-5-2026-04-22-thinking-{low,medium,high,xhigh}  33.33 / 70.42 / 83.33 / 85.00
//   gpt-5-5-pro-2026-04-23-{high,xhigh}                            84.58 / 84.16
//
// Every one matches, to the decimal, the rows batch 12 holds from Epoch's "ARC Prize verified
// leaderboard" — because Epoch transcribes this file. Batch 01 holds the same data again, hand-read
// off the rendered page and rounded to one decimal. So this fetcher does not add a fourth opinion:
// it replaces an independent mirror and a hand transcription with the benchmark-native original, at
// full precision, re-readable.
//
// Batch 01's ARC rows are therefore a hand-read of this file, and on 2026-08-07 they were
// superseded by it — the reason is written out in `supersededRows`. The short version, because it
// changes how you should read this file's `evaluation_date: null`: batch 01's ARC rows carried an
// `evaluationDate`, and every value of it is `models.json`'s `modelReleaseDate` to the day. That is
// when the model shipped, not when ARC ran it, and `byPrimaryPreference` sorts on that field — so a
// release date was choosing which ARC row the dashboard published, and it chose the rounded
// hand-read every time. Null here is not a gap next to batch 01's richer metadata; it is the
// absence of a quantity this source genuinely does not publish.
//
// ## What this fetcher interprets, and what it refuses to
//
// **1. It filters to `v2_Semi_Private` and nothing else.** The same file carries
// `v2_Public_Eval` and `v2_Private_Eval`, and the public split is exactly the trap
// `docs/AGENT-OPERATIONS.md` records: ARC's public-eval numbers run ~11 points above the verified
// board under the same benchmark name. The site's own `data.js` defaults to the `*_Semi_Private`
// series, and so does this. `v1_Semi_Private` (ARC-AGI-1) and `v3_Semi_Private` are real and
// collectable, but each needs its own benchmark id — a taxonomy decision, not a fetch.
//
// **2. It reads the operating point off the end of the model id, from a closed list, and leaves
// the id itself verbatim.** The first version of this fetcher left `reasoning_effort` null for
// every row, on the reasoning that the trailing token is an effort for some entries but a
// thinking-token budget for `-1k`, `-8k`, `-16k`, `-32k`, `-64k`, a serving route for
// `-openrouter`, `-together`, `-bedrock`, and a date or a release tag for others. That reasoning
// was right about the tokens and wrong about the conclusion, and the alias step is where it broke:
//
//   ARC publishes five entries for GPT-5.6 Sol — 42.5 / 67.08 / 85.42 / 90 / 92.5 — which are one
//   model at five operating points. With no effort on the row, all five key to the same cell, so
//   attaching them to the catalog fails the one-source-one-cell gate AND the 20% cross-source
//   disagreement gate, and the only way through either is an `acknowledgedDisagreements` or
//   `mergedInOneSource` exemption asserting that a 42.5 and a 92.5 are one measurement. They are
//   not. `scripts/fetchers/epoch.mjs` records the same failure from the other side: folding a
//   published operating point into null "makes it collide with rows from sources that simply did
//   not print an effort".
//
// So the token is read against a CLOSED list — the same one Epoch's splitter uses, including its
// `none` → `non-reasoning` synonym — and anything else leaves the field null. `-1k` and
// `-bedrock` and `-2026-07-30` are not on the list and never become an effort. What this cannot
// see is an effort that is not the last token: `openai-gpt-5-6-luna-max-2026-07-30` ends in a
// date, so it keeps a null effort. That is the conservative direction — a null effort is a row
// saying nothing, and the gates catch a collision if such a string is ever mapped.
//
// The id is still archived **verbatim**, unlike Epoch, which strips the effort off its slug. That
// is deliberate: a token misread as an effort only mislabels a configuration, while a token
// stripped out of the id merges two products and the alias table can no longer tell them apart.
// `max` is an effort for Anthropic and OpenAI and a product tier for Alibaba, and this board is
// the seventh spelling convention in the archive; identity stays the alias step's decision.
//
// **3. It archives entries that are not models.** `2025_human_panel`, `ARChitects`, `Icecuber` and
// the dated Kaggle solutions are on this board and are not catalog models. They stay in the
// archive unmapped, which `AGENTS.md` rule 8 calls the intended outcome rather than a gap.
//
// ## Why append-only
//
// ARC-AGI-2's semi-private set is frozen — that is what makes a verified score verified — but the
// board keeps running newly published models against it. So a cell that *appears* is new data and a
// cell that *changed or vanished* is the archive being contradicted, which is exactly the
// distinction `versioning: "append-only"` encodes. Declaring it `pinned` would turn the daily job
// permanently red the first time ARC verifies another model; declaring it `live` would accept a
// silently revised verified score as normal.

const SITE = "https://arcprize.org";
const BOARD = `${SITE}/leaderboard`;
const DATA = `${SITE}/media/data`;
// The split this catalog's `arc-agi-2` column means. Its siblings in the same file are a different
// measurement under the same name — see the header.
const DATASET = "v2_Semi_Private";

// The operating point, when the published id ends in one. Kept identical to the list
// `scripts/fetchers/epoch.mjs` uses — including `none` → `non-reasoning` — because Epoch reads
// this same board, so a shared vocabulary is what lets the two readings meet in one cell and be
// compared by the disagreement gate rather than sit side by side as two configurations.
const EFFORTS = new Set(["max", "xhigh", "high", "medium", "low", "minimal", "thinking", "non-reasoning"]);
const EFFORT_SYNONYMS = new Map([["none", "non-reasoning"]]);
// Both separators, because the board uses both: `openai-gpt-5-6-sol-max` and `claude_sonnet_4_6_max`
// are the same convention typed two ways, and Epoch reads the second one as max as well (58.33).
const effortOf = (modelId) => {
  const tail = String(modelId).split(/[-_]/).pop().toLowerCase();
  if (EFFORTS.has(tail)) return tail;
  return EFFORT_SYNONYMS.get(tail) ?? null;
};

const load = async (name) => {
  const url = `${DATA}/${name}.json`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length === 0) throw new Error(`no records in ${url} — the shape changed`);
  return payload;
};

export const arcprize = {
  id: "arcprize",
  label: "ARC Prize verified leaderboard",
  batch: "batch-23-arcprize",
  versioning: "append-only",

  // Required of any frozen source: the runner re-reads it at the version the archive already
  // holds, so that a comparison is between two readings of one question set rather than between
  // two different ones. Omitting it is not a silent degradation — `--check` throws
  // `fetcher.archiveVersion is not a function` — but the throw only happens on the drift path, so
  // a fetcher can be written, run, and land a batch looking entirely healthy, and take the daily
  // job red the next morning. This one was.
  //
  // The split id is reconstructed from the row rather than returned as a constant, so it is the
  // archive that names the version. `benchmark_version` holds `v2`, the datasetId is
  // `v2_Semi_Private`, and the `datasets.json` lookup below fails loudly if that no longer resolves.
  archiveVersion: (rows) => `${rows[0].benchmark_version}_Semi_Private`,

  async fetch(target) {
    const wanted = target ?? DATASET;
    const [evaluations, models, datasets] = await Promise.all([load("evaluations"), load("models"), load("datasets")]);

    // Fail rather than silently collect nothing if ARC renames the split. An empty batch would read
    // as "the board published nothing today", and this source's whole value is that re-reading it
    // is the drift check.
    const dataset = datasets.find((entry) => entry.id === wanted);
    if (!dataset) {
      throw new Error(`${wanted} is no longer in datasets.json — the splits are now: ${datasets.map((d) => d.id).join(", ")}`);
    }

    const named = new Map(models.map((model) => [model.id, model]));
    const selected = evaluations.filter((row) => row.datasetId === wanted && Number.isFinite(row.score));
    // `display: false` is the board's own decision not to show an entry. Archiving it would put
    // rows in the evidence store that the published board does not carry. The count is reported
    // rather than dropped quietly — a filtered batch that does not say so reads as a complete one.
    const shown = selected.filter((row) => row.display);
    const hidden = selected.length - shown.length;

    // ARC's own file carries a duplicate: `gpt-5-2025-08-07-low` appears twice on this split, both
    // displayed, both 1.94. The archive's contract is one row per published configuration, and the
    // drift key is model/benchmark/harness/effort — so keeping both would put two rows under one key
    // and the comparison would silently see only the last. Harmless while they agree, and precisely
    // the shape that hides a divergence on the day they stop.
    //
    // So an exact repeat collapses and is counted. The same id carrying *different* scores is a
    // different claim — the file contradicting itself — and picking one silently is the failure mode
    // this project keeps re-learning, so that throws instead. It cannot happen today; if it starts,
    // somebody needs to look at the board rather than at this diff.
    const byId = new Map();
    let duplicates = 0;
    for (const row of shown) {
      const seen = byId.get(row.modelId);
      if (!seen) { byId.set(row.modelId, row); continue; }
      if (seen.score !== row.score) {
        throw new Error(
          `${wanted} publishes ${row.modelId} twice with different scores (${seen.score} and ${row.score}). ` +
          "That is the source disagreeing with itself, not drift — read the board before changing this fetcher.",
        );
      }
      duplicates += 1;
    }

    const rows = [...byId.values()].map((row) => {
      const model = named.get(row.modelId);
      const provider = model?.providerId ?? null;
      const effort = effortOf(row.modelId);
      return {
        // Verbatim. This is the seventh spelling convention in the archive and the alias step is
        // where it gets reconciled; a fetcher that "tidies" a published id destroys the only thing
        // that ties the row back to the board.
        model_raw: row.modelId,
        benchmark: "arc-agi-2",
        // Read off the datasetId's own prefix rather than typed. `versionAliases` already maps
        // ARC's other spelling ("2", from the rendered page) onto this one.
        benchmark_version: wanted.split("_")[0],
        // Full precision, as published. The rounding to one decimal in batch 01 is an artefact of
        // reading the rendered page, not something the source does.
        score: Number((row.score * 100).toFixed(2)),
        unit: "%",
        harness: null,
        // Read off the end of the published id against a closed list, never guessed. Null when the
        // last token is a thinking budget, a serving route or a date. See the header, point 2.
        reasoning_effort: effort,
        tools_enabled: null,
        context_length: null,
        // Null on purpose. `models.json` carries `modelReleaseDate`, which is when the *model*
        // shipped, not when ARC evaluated it. Feeding that to a field the site sorts primary rows
        // by would silently reorder cells on a date that means something else.
        evaluation_date: null,
        source_label: `ARC Prize verified leaderboard · ${dataset.displayName}`,
        source_url: BOARD,
        source_kind: "benchmark",
        note:
          `对象：${dataset.displayName} semi-private 集（verified 板，非 public eval —— 后者同名但高约 11 分）；` +
          `发布 id ${row.modelId}` +
          (model?.displayName ? `，板上显示名「${model.displayName}」` : "") +
          (provider ? `，provider ${provider}` : "") +
          (Number.isFinite(row.costPerTask) ? `；每题成本 $${row.costPerTask}` : "") +
          (row.resultsUrl ? `；结果页 ${row.resultsUrl}` : "") +
          `；⚠ 本文件没有 effort 列，操作档位只在 id 末尾：` +
          (effort
            ? `本行读出 ${effort}（闭合清单内），id 原样保留`
            : `本行末尾不是档位词（是思考预算 / 服务路由 / 日期一类），effort 留空`),
      };
    });

    return {
      rows,
      version: wanted,
      summary:
        `${rows.length} verified entries on ${dataset.displayName}` +
        (hidden ? `; ${hidden} more carry display:false and were not archived` : "") +
        (duplicates ? `; ${duplicates} exact duplicate(s) in the source collapsed` : "") +
        `; ${evaluations.length} rows in the file across ${datasets.length} splits, only ${wanted} collected`,
      meta: {
        batch: "23 · ARC Prize verified leaderboard",
        collectedWith: "scripts/fetchers/arcprize.mjs",
        // Filtered at capture, three ways, all of them reported in the summary above.
        filtered: true,
        release: wanted,
        sources: [`${DATA}/evaluations.json`, `${DATA}/models.json`, `${DATA}/datasets.json`, BOARD],
        note:
          "Read from the four d3.json files /scripts/leaderboard/data.js loads, not off the screen: " +
          "the page renders client-side and its Next.js chunk contains no fetch. This is the " +
          "first-hand source that batch 12 (Epoch's mirror, matching to the decimal) and batch 01 " +
          "(hand-read, rounded to one decimal) both descend from, which makes batch 01's ARC rows " +
          "candidates for supersededRows — an editorial call, not made here. " +
          "FILTERED THREE WAYS: only datasetId v2_Semi_Private, because the same file carries " +
          "v2_Public_Eval, which runs ~11 points high under the same benchmark name; only " +
          "display:true, which is the board's own decision about what it publishes; and rows with a " +
          "finite score. v1_Semi_Private (ARC-AGI-1) and v3_Semi_Private are present and " +
          "collectable but each needs its own benchmark id. " +
          "reasoning_effort is read off the END of the published id against a CLOSED list (max, " +
          "xhigh, high, medium, low, minimal, thinking, non-reasoning, plus none -> non-reasoning) " +
          "and is null for everything else: this file has no effort column, and the trailing token " +
          "is a thinking-token budget (-1k, -8k, -16k, -32k, -64k), a serving route (-openrouter, " +
          "-together, -bedrock), a date or a release tag on many entries. The list is Epoch's, " +
          "because Epoch reads this same board and the two readings have to meet in one cell to be " +
          "comparable. An effort that is not the last token (openai-gpt-5-6-luna-max-2026-07-30) " +
          "stays null. The id itself is archived VERBATIM — unlike Epoch, which strips the effort " +
          "off its slug — so identity remains the alias step's decision. Entries that are not models " +
          "(2025_human_panel, ARChitects, Icecuber, the dated Kaggle solutions) are archived and " +
          "stay unmapped, per AGENTS.md rule 8. " +
          "append-only: the semi-private question set is frozen, but the board keeps running newly " +
          "published models against it, so an appearing cell is new data and a changed or vanished " +
          "one is an integrity failure.",
      },
    };
  },
};
