# AI Model Observatory Architecture

This document is the operational handoff for humans and coding agents. Read it before changing the data model, ranking semantics, deployment path, or UI structure.

## 1. System overview

```mermaid
flowchart TD
    A[Benchmark-native leaderboards] --> R[data/sources archive]
    B[Independent evaluators] --> R
    C[Vendor release material] --> R
    R --> N[npm run ingest]
    AL[data/model-aliases.json] --> N
    N --> D[Structured observations]
    D --> E[Derived score helpers]
    E --> F[Ranking and comparison UI]
    E --> G[Radar and line charts]
    H[OpenRouter models API] --> I[Live price route]
    I --> F
    J[Bundled price snapshot] --> F
    K[GitHub main] --> L[GitHub Actions CI]
    L --> M[EdgeOne Pages deploy]
```

The application has two data paths:

1. Versioned benchmark evidence, generated from the `data/sources/` archive into
   `app/observations.generated.ts` and combined with the seed rows in `app/model-data.ts`.
2. A live price **comparison** through `app/api/live-models/route.ts`. It does not write into
   the catalog. The card shows the archived list price, and the provider's current figure
   appears beside it only where the two disagree — a disagreement is a collection signal, not
   a number to display. See §6.

Current scale: **29 model families, 72 benchmarks, 1773 observations across 1090 of 2088 cells**,
sourced benchmark-native 880 / independent 703 / vendor 190. **318 of 321 catalog numbers are
backed by an archive row**; the three that are not are listed by `npm run check:models` on every
run rather than hidden.

## 2. Repository map

| Path | Responsibility |
| --- | --- |
| `app/model-data.ts` | Model metadata, benchmark taxonomy, observations, derived scores, source cards |
| `app/models/page.tsx` | The observatory itself: client state, rankings, coverage, radar, line charts, tables, language switching |
| `app/models/layout.tsx` | Its title — the page is a client component and cannot export metadata |
| `app/page.tsx` + `app/home-content.ts` + `app/home.module.css` | The owner's personal site at `/`. Reads no data file; see AGENTS.md "Two sites share this repo" |
| `app/api/live-models/route.ts` | OpenRouter price/context lookup and short-lived cache |
| `app/globals.css` | Light visual system and responsive layout |
| `data/sources/*.jsonl` | Append-only raw transcription archive, one row per published result |
| `data/model-aliases.json` | Every editorial decision: model mapping, benchmark splits, version and source-class overrides |
| `scripts/ingest.mjs` | Archive + aliases → `app/observations.generated.ts` |
| `scripts/lib/archive.mjs` | Alias resolution and archive reading, shared by ingestion and the gap report |
| `scripts/report-gaps.mjs` | What has *not* been collected: cells below a floor, unaliased rows, new upstream models |
| `scripts/publish-gaps-issue.sh` | Publishes that report to one self-updating GitHub issue |
| `docs/INGEST-PROMPT.md` | The transcription contract given to a browsing model |
| `docs/UI.md` | Type scale, breakpoints, the phone contract, and how to verify a layout change |
| `scripts/check-model-data.mjs` | Observation contract enforced in CI |
| `scripts/check-model-provenance.mjs` | Audits every catalog number against the archive |
| `scripts/fetchers/*.mjs` | One module per source this project can re-read by script |
| `scripts/fetch-source.mjs` | Runs them: writes a batch, or `--check` diffs every archive against upstream |
| `scripts/open-refresh-pr.sh` | Turns a moved live board into one self-updating pull request |
| `scripts/check-price-terms.mjs` | Fails when the catalog quotes a promotion recorded in a batch meta |
| `scripts/check-mobile.mjs` | Layout probe: overflow, type floor and tap-target floor under device emulation |
| `.github/workflows/ci.yml` | Lint, data contract, price terms, and production build checks |
| `.github/workflows/upstream.yml` | Daily: re-fetch archived sources for drift, then report what was never collected |
| `README.md` | User-facing overview and deployment instructions |
| `AGENTS.md` | Short coding-agent operating contract |

## 3. Core entities

```mermaid
erDiagram
    MODEL ||--o{ OBSERVATION : has
    BENCHMARK ||--o{ OBSERVATION : measures
    SOURCE ||--o{ OBSERVATION : publishes

    MODEL {
      string id PK
      string maker
      boolean open
      number contextK
      array configurations
    }
    BENCHMARK {
      string id PK
      string axis
      string mode
      string tier
      string version
    }
    OBSERVATION {
      number score
      string benchmarkVersion
      string evaluationDate
      string harness
      string reasoningEffort
      boolean toolsEnabled
      string contextLength
    }
    SOURCE {
      string sourceId PK
      string sourceKind
      string sourceUrl
    }
```

An observation is the atomic unit. Its conceptual key is:

```text
model × benchmark × benchmark_version × harness × reasoning_effort × tools_enabled × context_length
```

### Model identity

One record per model **family**. Reasoning effort is a property of a run, so it lives on the
observation row and in `ModelRecord.configurations`, never in the model id. An id like
`gpt-5.6-terra-max` cannot receive a leaderboard line that says only `GPT-5.6 Terra` without
someone guessing which effort was meant, and guessing is what this project exists to avoid.

`configurations` is ordered strongest first. The record's top-level `intelligence`, `speed`,
`price` and so on are derived from `configurations[0]` so rankings read one number per model;
the other operating points stay visible in the model dossier. Arena Elo is taken from
whichever configuration carries one, because Arena publishes no per-effort boards.

Arena Elo is the one field on the record that is **generated rather than authored**. It moves
continuously, so a typed value is stale immediately and a daily refresh would fight `check:models`
every morning. `npm run ingest` emits `ARENA_ELO` from the archive's parameter batches and the
record reads it, which leaves the archive as the only place the number lives and leaves the audit
with nothing to disagree with. The pick is per field and follows the audit's own precedence — the
flagship's operating point, then a row published with no operating point, then anything. That
middle rung is load-bearing: a bare `gpt-5.5` row is the board's model-level statement (1476) and
outranks a `gpt-5.5-high` row (1482) that merely appears earlier in the file.

### Ingestion pipeline

```text
data/sources/*.jsonl        raw transcription, never edited to fit the catalog
  + *.meta.json             retrieval date, and whether the batch was filtered at capture
  + data/model-aliases.json every editorial call, reviewable on its own
        │  npm run ingest
        ▼
app/observations.generated.ts    generated, do not hand-edit
        │
        ▼
OBSERVATION_ROWS in app/model-data.ts
```

The split matters: the archive is evidence and the alias file is judgement. A row with no
alias entry is **skipped and reported**, never guessed into place, and it stays in the
archive so it can be ingested later when the catalog gains that model. `npm run ingest`
prints every skipped row, so the cost of a missing catalog entry is always visible.

Resolution is `(model_raw, effort)` and, since 2026-08-05, optionally the batch file: an alias may
carry `"file"` and a file-scoped entry beats a global one. It exists because a published string is
not always one model. DeepSeek shipped V4 Flash as a preview and then as the post-trained 0731
release; LiveBench, Epoch and LMArena publish both under `deepseek-v4-flash` and
`deepseek-v4-flash-0731`, while Artificial Analysis kept the bare slug for the *official* model.
One global mapping cannot express that, and the one that existed put the preview's LiveBench
scores in the 0731 record — half the real numbers, on 23 cells, with every check green. Effort
cannot stand in for the scope: on LiveBench neither release carries one. Scope is a last resort;
a string nobody can attribute stays unmapped, which is what rule 8 asks for.

Values in the archive are never altered, but a batch may be **filtered at capture**: batches
02-04 kept the 2026-era frontier rows and dropped the long tail of pre-2026 models the
catalog will not track. Each batch's `.meta.json` records `filtered`, the rule used, and the
source URLs, so a fuller re-transcription can be dropped in later — `npm run ingest` picks
up whatever the files contain, with no code change.

`data/model-aliases.json` carries every kind of judgement the archive itself must not encode,
each with a written reason:

| Key | Decides |
| --- | --- |
| `aliases` | which published model string is which catalog model, at which effort — and, where a string means different models in different sources, in which batch file |
| `benchmarkSplits` | when a published "version" is really a different problem set |
| `versionAliases` | when two sources spell the same version differently |
| `benchmarkAliases` | when an evaluator uses its own name for a benchmark already catalogued |
| `versionFallbacks` | when a source publishes no version label and the catalog owns the column |
| `droppedBenchmarks` | what is deliberately not carried, and why |
| `sourceKindOverrides` | when a page's source class is not what it looks like |
| `supersededRows` | when a later reading replaces an earlier one — a whole batch, one benchmark, or a single field of a single row |

`sourceKindOverrides` is not cosmetic. Epoch AI's FrontierMath page is benchmark-native because
FrontierMath is Epoch's own benchmark; Epoch's GPQA page is an *independent* evaluation,
because GPQA belongs to someone else and Epoch is a third party running it.

`supersededRows` exists because the archive is append-only and a scripted fetch is not a
correction of the transcription it replaces — it is the same measurement, read exactly instead
of by eye. Batch 02 read 18 DeepSWE rows off the screen rounded to whole points; batch 11 reads
all 50 configurations from the artifact the page loads. Ingesting both would put two rows in one
cell and let the rounded reading win the primary slot, because a system benchmark keeps the
highest score within a source class and 74 beats 73.6. So the transcribed rows stay in the
archive as evidence of what the page showed that day, and the alias file records that they are
no longer ingested. `npm run ingest` prints them, like every other skip.

An entry can be scoped four ways, narrowing from a whole batch down to one number:
`file` alone supersedes everything in a batch; `benchmark` and `benchmarkVersion` narrow it to a
column (batch 02 holds Terminal-Bench 2.0 and 2.1 under one name and only 2.1 was rescripted);
`modelRaw` and `field` narrow it to a single value in a single row. The last pair exists because
of Inkling: the Tinker pricing page publishes 256K, which is that product's serving limit, while
the model's own `config.json` publishes 1,048,576. Both are true, both are archived, and neither
should be deleted — the entry only tells the provenance audit which one answers "what is this
model's context window".

### Observation store

`OBSERVATION_ROWS` is the canonical store: a flat list where every entry carries its own
`modelId`, `benchmarkId` and full provenance. Everything else is derived from it.

```text
OBSERVATION_ROWS            all transcribed rows, one per published configuration
  └─ OBSERVATIONS_BY_CELL   grouped by model × benchmark, sorted by source strength
       └─ BENCHMARK_OBSERVATIONS   the primary row of each cell
            └─ BENCHMARK_SCORES    the primary score of each cell
```

A single cell may hold several rows, because these are different results and must not be
merged: Terminal-Bench 2.1 reports Fable 5 at 83.8% under Claude Code and 80.4% under
Terminus 2. Both are stored; the table shows the primary and marks the rest as `+n`.

Primary selection is mechanical, not editorial:

1. Source strength — `benchmark` > `independent` > `vendor`.
2. Within the same class, a **system** benchmark keeps the highest score (best available
   scaffold, which is what a system lens means) and a **model** benchmark keeps the most
   recent evaluation.

Do not create an independent score table or add a number without provenance.

## 4. Source policy

Use the strongest available source for each observation:

1. **Benchmark-native leaderboard** — preferred because its version and harness are controlled by the benchmark owner.
2. **Independent evaluator** — useful for cross-model consistency and professional-work evaluations.
3. **Vendor release material** — valid for filling gaps, but preserve its exact model configuration and harness notes.

The Kimi K3 release table is a useful comparison seed, not the benchmark standard. The same rule applies to every vendor table.

Do not merge values when any of these differ materially:

- DeepSWE v1.0 vs v1.1
- Terminal-Bench 2.0 vs 2.1 (now separate benchmark ids)
- HLE without tools vs with tools
- MRCR 128K average vs 1M pointwise
- Codex vs Claude Code vs Kimi Code vs Terminus vs mini-SWE-agent
- low/high/max reasoning effort

## 5. Capability and ranking semantics

Seven radar axes are defined in `AXES`. An axis is calculated only from available compatible core observations. Missing axes remain absent; they are not zero-filled.

Coverage means evidence completeness, not model quality:

| State | Meaning |
| --- | --- |
| `Not ingested` | No compatible core observation is loaded |
| `Partial` | Some compatible core observations are loaded |
| `Broad` | At least half of compatible core observations are loaded |

Ranking lenses stay separate:

- General capability: independent composite snapshot stored on the model record.
- Coding system: core system-level coding observations, subject to the coverage floor below.
- Agent system: core system-level agent observations, subject to the coverage floor below.
- Human preference: Arena Elo.
- Speed: output tokens per second.
- Value: current capability/cost heuristic.

These lenses answer different questions and must not be silently blended.

### The portfolio coverage floor

A portfolio average compares models only when they were measured on comparable baskets. Averaging
whatever cells happen to exist does not: it rewards thin evidence, because a model measured only
on the generous benchmarks of an axis outscores one measured on all of them.

This was not hypothetical. On the agent lens, `Muse Spark 1.1` ranked first at 81.9 from 2 of 5
agent benchmarks — `mcp-atlas` and `toolathlon`, where every model scores in the 70s and 80s —
while `Claude Fable 5`, measured on all five including `osworld2` where scores collapse, sat
fifth at 75.7. `Inkling Small` ranked second on a single cell.

So `portfolioScore` publishes a number only when the model covers **at least half of that axis's
core benchmarks and at least two of them** (`PORTFOLIO_MIN_RATIO`, `PORTFOLIO_MIN_CELLS`,
`portfolioFloor` in `app/model-data.ts` — the data layer, not the page, because
`npm run report:gaps` reads the same rule to find the models sitting one cell below it).
Below the floor the value is `N/A` and the model leaves that ranking, the same
way a model with no published cost per task is absent from the value lens rather than free. Each
ranking cell and dossier KPI prints its `present/total` count, so the floor is visible rather than
inferred.

The floor applies to the ranking table and the dossier KPIs. The radar still plots every axis it
has evidence for, because it reports one axis at a time next to an explicit coverage figure
rather than collapsing a basket into a rank.

Consequence to keep in mind: with 5 core agent benchmarks the floor needs 3, and the long-context
axis has 2 core benchmarks that no model currently carries together. Adding a benchmark to an axis
raises the bar for every model on it.

## 6. Runtime and deployment

```mermaid
sequenceDiagram
    participant Dev as Human or AI
    participant GH as GitHub main
    participant CI as GitHub Actions
    participant EO as EdgeOne Pages
    participant User as Browser

    Dev->>GH: Push source change
    GH->>CI: Trigger validation
    CI->>CI: npm ci, lint, data check, build
    GH->>EO: Trigger production build
    EO->>User: Serve Next.js UI and API route
    User->>EO: Request live prices
    EO->>EO: Look up exact provider ids, or return 503
    User->>User: Compare against the archived price, never replace it
```

### The live price path is a comparison, not a refresh

Two rules of this project make an overwriting price feed impossible to keep honest. The catalog
quotes **list price, never a promotion** (§10), and every catalog number is **backed by an archive
row** (`npm run check:models`) — a figure that arrives at runtime satisfies neither. The feed used
to write straight into the model record anyway, which meant the dashboard silently published the
Claude Sonnet 5 introductory rate that §10 exists to exclude, and `check:prices` could not see it
because that check runs at build time over batch metadata.

So the archived price is what the card shows. OpenRouter's current figure sits beside it and is
rendered only where the two disagree by more than 0.5%. Today 17 of 27 corroborate the archive
exactly, which is a provenance signal worth having; the other 10 are a collection queue.

Lookups are **exact provider ids**, never substrings. `list.find` returns the first id containing
the needle, and OpenRouter serves overlapping names: the needle `gpt-5.6` matched
`openai/gpt-5.6-luna-pro`, so the GPT-5.6 Sol card rendered $0.10/$0.60 in place of $5/$30. Six
other lookups landed on a `-fast`, `-pro` or `-lite` variant the same way, and none of it was
visible, because a wrong price looks exactly like a right one. A retired id now resolves to
nothing and the card keeps its archived figure, which is the safe direction to fail in;
`npm run report:gaps` reports the dead lookup.

Canonical production settings:

```text
Node.js: 22
Install: npm ci
Build: npm run build
Output: .next
Host: Tencent EdgeOne Pages
Source branch: GitHub main
```

GitHub Pages is intentionally not used because it is static-only and cannot run the current Next.js API route.

EdgeOne builds from `main` independently of GitHub Actions. A failing CI run does not block a
deploy — only a failing `npm run build` does. `check:prices` and `check:upstream` are therefore
notifications rather than gates: they turn CI red while the site keeps serving whatever was last
merged. Read the CI result before merging, not after.

## 7. Change playbooks

### Add a model

1. Collect its operating parameters into a `data/sources/batch-NN-*.jsonl` with a
   `.meta.json` whose `schema` starts with `Model operating parameters`. That prefix is what
   keeps the batch out of the observation store and inside the provenance audit.
2. Add the published model strings to `data/model-aliases.json`. One family id, `effort: "*"`.
3. Add one `ModelRecord` to `MODELS` with a family-level id — never an effort in the id — and
   one `cfg(...)` per published operating point, strongest first.
4. Add provider lookup aliases to `app/api/live-models/route.ts` when live pricing exists.
5. `npm run ingest` — archived observations for that model attach themselves.
6. `npm run check:models` must pass; anything it calls unsourced needs a source or stays null.
7. Let unavailable data remain absent. A model with no published cost per task drops out of
   the value lens; it is not free.

### Add a benchmark

1. Add one `BenchmarkRecord` with axis, mode, tier, method, version and canonical URL.
2. Decide `core` / `observe` / `legacy` **before** adding scores. Only `core` feeds the radar,
   so a new evaluation of unproven comparability belongs in `observe`.
3. Add the rows to the archive; never hand-write them into `app/model-data.ts`.
4. If an evaluator uses its own name for a benchmark already in the catalog, map it with
   `benchmarkAliases` rather than creating a duplicate column.
5. If a published "version" is really a different problem set, split it with
   `benchmarkSplits` — FrontierMath Tiers 1-3 and Tier 4 are the worked example.
6. Confirm line-chart normalisation; Elo uses a separate path.

### Update an existing result

1. Never overwrite a value merely because a newer table has a different number.
2. Check whether version, harness, reasoning effort, tools, context length, model snapshot, or aggregation changed.
3. If the result is not comparable, model it as a distinct benchmark/version or update the schema before ingestion.
4. Record the new evaluation date and source URL.

## 8. CI contract

Every push and pull request must pass:

```bash
npm run lint
npm run ingest && git diff --exit-code app/observations.generated.ts
npm run check:data
npm run check:models
npm run check:prices
npm run build
```

`npm run check:upstream` is deliberately **not** in that list. It re-fetches an archived source
over the network and fails for reasons unrelated to the commit under review, which is how a red
check gets trained into background noise. It runs daily instead, in `.github/workflows/upstream.yml`.

`npm run report:gaps` is not in that list either, for a different reason: **it can never fail.**
An uncollected model is not a defect in the commit under review, so the report exits zero no
matter what it finds and the finding becomes an issue instead. The daily job publishes it to one
long-lived issue titled *Collection gaps*, edited in place and closed when the report comes back
empty — so an open issue always means there is something to collect, and there is never a backlog
of stale issues to ignore. Add `--no-network` to run the two local sections offline.

The data check currently enforces:

- unique model and benchmark IDs;
- no observations for unknown entities;
- finite numeric scores;
- source and version provenance;
- every derived score maps to an observation;
- an evaluation date **or** a retrieved date on every row, both ISO, never interchanged;
- `app/observations.generated.ts` matches a fresh `npm run ingest` (CI re-runs and diffs it);
- no catalog number contradicts the archive (`npm run check:models`);
- a benchmark-native system result names its harness;
- no duplicate row for one identical configuration;
- **no cell mixes two benchmark versions** — one cell is one table column, so two versions
  in it would compare one model's version against another's;
- minimum catalog/model size;
- retention of a known official Gemini 3.5 Flash observation as a regression guard;
- every catalog number, including context window and open-weights status, agrees with the
  archive or is reported as unsourced (`npm run check:models`); context length is *reported*
  rather than failed on, because a 1,048,576-token window reaches this project as 1000, 1049 or
  1050 depending on who rounded it;
- no `model_raw` differs from an existing alias only in casing — alias resolution is
  case-sensitive, so such a row resolves to nothing and is silently dropped from ingest;
- no catalog price is a promotion recorded in a batch's `priceTerms` (`npm run check:prices`);
  the archive keeps the promotional row, but it can no longer back a price check, the same way
  an Arena price never could.


## 9. Collection state

Twenty-two archive batches, all under `data/sources/`. Read this before re-running a source: several
pages are known-dead or known-empty and were already worked around.

| Batch | Covers | Outcome |
| --- | --- | --- |
| 01 | Reasoning and maths | ARC Prize, Epoch FrontierMath + GPQA. Complete transcript. Its GPQA rows are superseded by batch 12 and its 95 ARC rows by batch 23 — both are the same board read by script afterwards. The ARC supersede also retired a wrong field: every `evaluation_date` on those rows is ARC's `modelReleaseDate` to the day, and `byPrimaryPreference` sorts on that field, so a release date was deciding which ARC row the site published. |
| 02 | Coding and software engineering | Terminal-Bench 2.0/2.1, SWE-bench, SWE-Bench Pro, DeepSWE, SWE-Marathon, FrontierSWE, PostTrainBench, ProgramBench. Complete, 313 rows. |
| 03 | Agents and tool use | MCP-Atlas, Toolathlon, OSWorld 2.0, Agents' Last Exam. Filtered at capture. |
| 04 | Multimodal, long context, professional | GDPval-AA, APEX, MMMU. Lowest yield of the set. |
| 05 | Independent evaluators | Vals AI sub-benchmarks, LMArena. Complete, 538 rows. |
| 06 | Model operating parameters | AA model pages, vendor pricing, LMArena Elo. |
| 07 | AA leaderboard main table | Cost per task, which batch 06 could not reach. |
| 08 | Operating parameters, second pass | AA model pages plus Anthropic, Google, DeepSeek, Alibaba, Z.AI and Thinking Machines pricing. Took catalog provenance from 67% to 97% and corrected 43 values. |
| 09 | LiveBench | 23 task columns × 36 models = 828 rows, fetched by script, not transcribed. Took cell coverage from 25.7% to 47.2%. |
| 10 | Standard vendor pricing | Claude Sonnet 5's list $3/$15. No new retrieval — promoted from batch 08's capture, where it sat in a row's note. |
| 11 | DeepSWE | 50 configurations fetched from the artifact the board loads. Supersedes batch 02's 18 transcribed rows of the same page. |
| 12 | Epoch AI export | 538 rows from the CC BY ZIP: Epoch's own GPQA runs plus four second-hand boards with no first-hand path. **FrontierMath and Tier 4 are deliberately not read** — the export disagrees with Epoch's own page by about 1.7x; see the fetcher header. |
| 13 | Terminal-Bench 2.1 | 17 submissions from the Supabase function the page calls, each with its agent, effort and run date. Supersedes batch 02's 2.1 rows. |
| 14 | Artificial Analysis | 590 configurations of operating parameters from the REST API. Not observations — this batch feeds `check:models`. On demand, needs `AA_API_KEY`. |
| 15 | Model config.json | Context windows read from each model's own Hugging Face `config.json`. Two rows, added to settle whether Inkling's window is a serving limit or an architectural maximum. |
| 16 | ALE supplement | Three rows batch 03 missed despite promising every row that maps to a catalog model. Hand-read; ALE publishes nothing machine-readable. |
| 17 | Qwen3.8 release tables | Both performance tables from the 2026-08-03 release post, 465 rows: 86 benchmark labels × 8 published model columns. Captured by rendering the page, not by eye — `scripts/capture-release-tables.mjs qwen3.8`. Only Qwen3.8-Max is mapped; the competitor columns are archived and refused per-file. 12 rows land in a catalog column, and they wait on a catalog record. |
| 18 | Agents' Last Exam | 57 configurations across 24 models and 11 harnesses, read from the endpoint the leaderboard page calls. Supersedes the 19 rows batches 03 and 16 hand-read on the stated grounds that ALE publishes nothing machine-readable. |
| 19 | GDPval-AA v2 | 175 configurations, rendered from the leaderboard AA publishes for free. Its API keeps this evaluation behind the Pro tier, which is why §9 listed GDPval as having no scripted path. Supersedes batch 04's 14 hand-read rows. |
| 20 | MMMU-Pro leaderboard | 71 models carrying an MMMU-Pro Overall score, rendered from the official board. Supersedes batch 04's two hand-read rows, which filed an author-reported score as benchmark-native. |
| 22 | LMArena Elo | 493 rows across two boards, read from the pages' own server-rendered payload. Not observations: Arena Elo is human preference, not task accuracy (rule 5), so it stays a model parameter. This is the batch `ARENA_ELO` derives from, which is why the catalog no longer carries an Elo at all. |
| 21 | QwenCloud operating parameters | Price, cache price and context for Qwen3.8 Max, read from the maker's own marketplace card and release changelog. Collected because the two list-price tables (Alibaba Model Studio, QwenCloud docs) still carried only the 3.7 family three days after release, and Artificial Analysis had not measured the model at all. |
| 23 | ARC Prize verified leaderboard | 198 entries on the ARC-AGI-2 semi-private split, from the file the board loads. **The first-hand source batch 12 (Epoch's mirror) and batch 01 (hand-read, rounded to one decimal) both descend from** — verified to the decimal against models already in the catalog. Filtered three ways, all reported: `v2_Semi_Private` only, `display:true` only, and one exact duplicate ARC publishes collapsed. `reasoning_effort` is read off the end of the published id against a **closed list** — Epoch's, including its `none` → `non-reasoning` synonym — and is null for the 81 rows whose last token is a thinking-token budget (`-1k`…`-64k`), a serving route (`-openrouter`, `-bedrock`) or a date. It landed with the field null on every row, which turned out not to be a neutral choice: ARC publishes five entries for GPT-5.6 Sol spanning 42.5 to 92.5, and with no effort on the row they all key to one cell, so attaching them failed both the one-source-one-cell gate and the 20% disagreement gate and could only be forced through with an exemption asserting a 42.5 and a 92.5 are one measurement. The id itself is still archived verbatim, unlike Epoch's, so identity stays the alias step's decision. **52 strings were attributed on 2026-08-07** (37 of them confirmed by matching an already-attributed Epoch row to the decimal on the same model-and-effort cell), which added ARC-AGI-2 to Claude Fable 5, Gemini 3.6 Flash and Inkling Small, and replaced seven rounded hand-read numbers with the full-precision originals. |
| 24 | ARC Prize · ARC-AGI-1 | 197 entries on the `v1_Semi_Private` split, same file and same fetcher body as batch 23 — `evaluations.json` carries all eight splits, so a second board costs an argument rather than a second scraper. Carried as a **legacy** benchmark: 16 catalog families land on it and the top is saturated (98.5 / 98 / 97.5 across three makers), so it separates the middle of the field and not the frontier, and `legacy` keeps it out of the portfolio floor. One string exists only here — `anthropic-opus-4-8-max`, which ARC never ran on ARC-AGI-2. |
| 25 | ARC Prize · ARC-AGI-3 | 26 entries on `v3_Semi_Private`, six catalog families, every one under 8% except Claude Opus 5's 30.16. Carried as **observe** for exactly that reason — a column at the floor is not a ranking — but it is the only unsaturated ARC split, so it is where movement will show first. Two entries here are deliberately unmapped and both look mappable: `openai-gpt-5-5-2026-04-23-high` displays as plain "GPT-5.5 (High)" and `google-gemini-3-1-pro-preview` as "Gemini 3.1 Pro (Preview)", but each sits in a different `modelGroup` from the string this catalog already carries, which is the board saying they are separate dated snapshots. Cost: two cells at 0.43 and 0.42. |
| 26 | Artificial Analysis evaluations | AA's own runs of seven benchmarks, from `/api/v2/data/llms/models` — a **different path** from batch 14's `/api/v2/language/models/free`, on the same key. Measured 2026-08-07: the free path publishes 3 `evaluations` keys and this one publishes 17. Kept a separate batch because batch 14 declares model operating parameters, which is what keeps its rows out of the observation store. Adds 110 cells, and gives `hle-no-tools` and `scicode` — until now held up entirely by one vendor release table — an independent reading. Every mapping was checked against AA's published methodology table, which is also what decides `hle` is the no-tools column (its Tool Usage entry is ✗) rather than a guess. Ten of the seventeen keys are deliberately not collected, each with a reason in the fetcher header — `terminalbench_hard` because AA itself calls it superseded and out of active reporting, `tau2` because it appears in neither the methodology nor the leaderboard. `manual`: AA re-measures continuously, so this never enters the daily refresh. |

### Which sources can be re-read by script

Measured twice on 2026-08-01. **Do not re-probe without reading this** — and note *how* the two
passes differed, because that is the reusable part.

The first pass fetched each landing page and searched it for referenced `.json`/`.csv` assets,
`/api/` strings and framework state. That found DeepSWE and nothing else. **It was wrong about two
sources**, and wrong in a way worth naming: a landing page cannot tell you about a data file
published somewhere other than the site. The second pass looked for exports, repositories and the
endpoints a client builds at runtime, and found the two largest additions to this archive.

| Source | Verdict |
| --- | --- |
| LiveBench | `table_<release>.csv` + `categories_*.json` + `cost_*.csv`. **Scripted, batch 09.** |
| DeepSWE | `/artifacts/v1.1/leaderboard-live.json` — every configuration with harness, effort, pass@1, CI, cost. **Scripted, batch 11.** |
| Epoch AI | `epoch.ai/data/benchmark_data.zip` — 76 CSVs, CC BY. Invisible from the page. **Scripted, batch 12** — but not every CSV is usable: the FrontierMath files disagree with Epoch's own leaderboard by about 1.7x and are excluded. An export being official does not make it the same measurement as the page. |
| Terminal-Bench | An unauthenticated Supabase Edge Function the page calls, found in Harbor's client source. **Scripted, batch 13.** |
| Artificial Analysis | A documented REST API at `/api/v2`. **Scripted, batch 14**, on demand with `AA_API_KEY`. The free tier carries intelligence index, cost per task, speed, latency and pricing; GDPval-AA and AA-LCR return 403 behind the Pro tier, so those two core benchmarks still have no scripted path. |
| MMMU | The board renders client-side and is read that way — **scripted, batch 20**. Its legend is load-bearing: `*: results provided by the authors`, so the asterisk decides `source_kind`, and the fetcher refuses to write if the page stops saying it. |
| GDPval-AA | The API answers 403 (Pro tier) but the leaderboard **page** is public and client-rendered. **Scripted, batch 19**, by rendering it — the first fetcher that drives a browser, and the most fragile one for that reason. Its harness and tool setting are re-read from the page text every run rather than carried over from the transcription. |
| Agents' Last Exam | `/api/demo/leaderboard` — 689 rows, 25 models, 15 harnesses, 12 splits, with pass rate, partial credit, task counts and cost. **Scripted, batch 18.** The path appears only inside the leaderboard page's client chunk; `/api/leaderboard` and `/data/leaderboard.json` are both 404, which is how two passes concluded the board publishes nothing machine-readable. |
| Humanity's Last Exam | `lastexam.ai` server-renders its table, so it *could* be scripted — but re-reading it on 2026-08-05 returned the same nine models and the same scores batch 01 transcribed, down to the decimal. The source has not published a frontier model in a generation. Scripting it would buy a drift check on a board that does not move, not new cells. |
| Qwen release posts | No data file found: `?id=` returns the SPA shell, `/api/blog?id=` returns the same, and there is no `qwenlm.github.io` mirror. But the tables are real DOM once the app runs, so they are captured by rendering the page over CDP — **scripted, batch 17**, `scripts/capture-release-tables.mjs`, run per release rather than daily. A release post is frozen after publication, so there is nothing for a drift check to watch. |
| LM Arena | **Scripted, batch 22** — and the sixth "no path" verdict in this table to be overturned by looking again. The old entry was true about what it named: `lmarena/arena-catalog` decodes perfectly and stopped syncing a generation ago. It was never a claim about the site. `lmarena.ai` now redirects to `arena.ai`, which serves each board **server-rendered** with the whole snapshot embedded as JSON — no browser, no key, a plain fetch. The `/api/` path answers 403 "Route not allowed", so the page's own payload is the published artefact. Two boards: `text-overall-style_control` → `text_elo`, `webdev-overall-raw` → `code_elo`. |
| SWE-bench | `swe-bench.github.io/data/leaderboards.json`, 180 Verified entries, genuinely fetchable — and useless: the newest entry is Opus 4.5 from 2025-12, and `swe-verified` is a legacy column. The HELM situation exactly. |
| Scale, MMMU, Mercor APEX, HLE | Hugging Face's `/api/datasets/{id}/leaderboard` returns 200 for all four, which is a trap: every record is a **vendor self-report scraped from the model's own card**, `verified:false`, with no version, harness, effort or date. SWE-bench Pro's mixes 19 model-card claims with 6 official rows and nothing distinguishes them. |
| ARC Prize | ⚠ **Reversed 2026-08-07 — scripted, batch 23.** This row used to read "the verified board publishes nothing readable", which was the seventh entry in this table to be overturned by looking again. The data is at `/media/data/evaluations.json` (808 rows across 8 splits), loaded by four `d3.json()` calls in `/scripts/leaderboard/data.js`. It is not in the Next.js chunk: `/leaderboard` renders client-side, its page chunk is 6KB with no `fetch(` in it, and the HTML carries no model names — read only those two, as the first pass did, and the old verdict is what you get. **It is also the first-hand source batch 12 and batch 01 both descend from**, verified model-for-model to the decimal against Epoch's mirror. The public-split warning below still stands and is why each fetcher pins one `*_Semi_Private` split. `scripts/fetchers/arcprize.mjs` exports three boards over that one file — ARC-AGI-1, 2 and 3, batches 24, 23 and 25. |
| ARC Prize public eval | `arcprize/arc_agi_v2_public_eval` is a **different split** and the same file carries it as `v2_Public_Eval`: GPT-5.2 xHigh scores 64.0 there against 52.9 on the verified board. Substituting it would move the column ~11 points, so every ARC batch filters to `*_Semi_Private` exactly as the site's own `data.js` does. The semi-private siblings **were** collected on 2026-08-07 — `v1_Semi_Private` as batch 24 and `v3_Semi_Private` as batch 25, each with its own benchmark id per rule 4. What stays uncollected is the public half of all three and the two `*_Private_Eval` splits: three rows between them, and a private split is by construction not something a reader can check. |
| Vals AI, OSWorld, FrontierSWE, ALE, MCP-Atlas | Nothing machine-readable, on either pass. Their numbers reach the catalog only by hand, or second-hand through Epoch. (ALE was reversed on 2026-08-05 — see batch 18.) |
| QwenCloud Model Marketplace | Client-rendered cards, one per model, carrying list price, cache prices, context and rate limits — and a labelled `50% off` / `20% off` where a promotion runs, which is what makes the unlabelled figure readable as a list price. **Read once by hand for batch 21**; a fetcher is feasible and would give the price column its first drift check, but a daily price refresh needs a `versioning` declaration and a rule for what to do when a promotion starts, which is a decision rather than a script. |

Thirteen of twenty-six batches are re-read by script, and only those twelve have a drift check or an
automatic refresh. The rest are hand transcriptions whose only freshness signal is how long ago
someone read them — which is why the source cards print that date (§10). Batch 17 is a tenth kind:
scripted, but run per release rather than daily, because a release post is frozen once published.

Batch 09 is the first batch collected by a script rather than a browsing model. LiveBench renders
client-side and batch 05 recorded it as UNAVAILABLE for that reason, but the page loads
`table_<release>.csv`, `categories_<release>.json` and `cost_<release>.csv` from its own asset
directory — those files *are* the published numbers, so `npm run fetch:livebench` copies them
directly. This is strictly more faithful than reading a rendered table: no row limit, no
transcription error, and re-running it is the drift check (`npm run check:upstream`).

Three LiveBench decisions worth not re-litigating:

- **`source_kind` is `benchmark`, not `independent`.** Batch 05's prompt filed livebench.ai under
  independent evaluators, but that instruction never produced a row, and LiveBench publishes its
  own tasks — it is benchmark-native, which is also what `SOURCE_REGISTRY` already said.
- **Only task columns are archived.** LiveBench's category averages and Global Average are
  computed in the browser from those same columns. Archiving them would create a score with no
  published source *and* double-count its own components, which is what dropped `vals-index`.
- **The Agentic Coding tasks name `mini-SWE-agent` as their harness.** The leaderboard prints no
  scaffold, so the harness is taken from the runner LiveBench vendors at
  `livebench/agentic_code_runner/minisweagent`. Without it a benchmark-native system result would
  fail the harness rule, and the honest fix was to find the scaffold, not to relabel the rows.

Known-dead or known-empty, with the workaround already applied:

- `os-world.github.io` and `osworld-v1.xlang.ai` — stuck on "Loading verified benchmark data".
  OSWorld 2.0 was taken from `osworld-v2.xlang.ai` instead; 1.0 and Verified have no rows.
- `lastexam.ai` with-tools board — stuck on "Loading HLE results". `hle-tools` therefore has
  no benchmark-native rows, and the no-tools figures were deliberately **not** substituted.
- `github.com/SWE-EVO/SWE-EVO` — publishes no numeric leaderboard at all.
- `github.com/GAIR-NLP/IMOAnswerBench` — 404. Scores came from the IMO-Bench paper instead.
- `github.com/facebookresearch/programbench` — no table; `programbench.com` has it.
- `huggingface.co/datasets/openai/mrcr` — dataset card publishes no scores.
- MMLU-Pro HF Space and OpenRouter's model table — never rendered.

**Stanford HELM was measured and declined on 2026-08-01.** It is reachable and fully
machine-readable — every project publishes JSON under
`storage.googleapis.com/crfm-helm-public/<project>/benchmark_output/releases/<version>/` — so the
obstacle is not access. Across all 18 projects and roughly 700 model deployments, exactly one
model overlaps this catalog: `deepseek-v4-pro-thinking-disabled`, in `arabic-enterprise`. HELM's
frontier project, `capabilities` v1.15.0, tops out at GPT-5.1, Gemini 3 Pro Preview and Grok 4 —
about a generation behind. Connecting it would add a source card and no cells, which is the exact
move AGENTS.md warns about. Re-measure before reconsidering; the sweep is a short script against
the `runs.json` of each project's latest release.

Deliberately not carried, with reasons in `droppedBenchmarks`: LMArena text Elo as a benchmark
(383 rows — it is a preference lens and already lives on the model record), the Artificial
Analysis and Vals composite indices (they double-count their own components), and a few
Vals benchmarks with one to three rows.

Rows whose source publishes **no benchmark version** are archived but not ingested. This
currently costs SWE-Marathon, PostTrainBench and ProgramBench. It is deliberate: ProgramBench's
official Resolved score for GPT-5.5 is 0.5% while the Kimi vendor table reports 70.8 for the
same cell, so those columns would silently mix two different metrics.

## 10. Known limitations and next work

**Thirteen of twenty-six batches now maintain themselves; the other thirteen cannot.** This paragraph used
to say four of fifteen, then nine of twenty-two, then ten of twenty-three, and — more usefully — it used to say that closing the gap was not a code
problem, because "§9 records that no other source publishes a data file to read". That was wrong,
and it was wrong in the most expensive way a written-down answer can be: it told the next person
not to look.

Three sources were added on 2026-08-05 that this document had recorded as unreachable.
Agents' Last Exam was hand-read twice on the stated grounds that it publishes nothing
machine-readable; its leaderboard calls `/api/demo/leaderboard`, a path that exists only inside
the page's own JavaScript bundle, and it returns 689 rows. GDPval-AA sits behind Artificial
Analysis' Pro tier in the API while the leaderboard page is public and free — so it is read by
rendering it. MMMU is read the same way, and its legend turned out to carry the thing the
transcription had lost: `*: results provided by the authors`, which decides `source_kind`.

So the standing instruction is now the opposite. **Re-probe before believing a "no path" verdict,
including one in this file**, and record what you tried. The same reversal happened to the release
pages on the same day: four makers were recorded as having no readable index and all four had one,
three of them on a documentation host while the marketing site blocked. A verdict that says "no
path" is a claim about the search, not about the source.

**It is no longer the whole of the remaining work, though, and the reason is worth stating plainly:
a scripted source is not automatically a correct one.** Epoch's FrontierMath export disagreed with
Epoch's own leaderboard by about 1.7x, and every structural check passed — the rows were
well-formed, versioned, dated and attributed. What caught it was a second source disagreeing, and
that only exists where a benchmark has been read twice. **Measured 2026-08-07: 47 of the 70 columns
had exactly one source**, and four of those were core (`frontiermath`, `frontiermath-t4`,
`imo-answer`, `aa-lcr`). On any of them, nothing would contradict a wrong reading. Batch 26 moved
`aa-lcr`, `hle-no-tools` and `scicode` off that list by giving them a second reading, and added
two columns (`tau3-banking`, `ifbench`) that join it — the trade is deliberate and `describe-change`
prints the count on every run. `ARC-AGI-1` and
`ARC-AGI-3` joined that set the day they were added — nobody else publishes those splits — which is
why `describe-change` prints how many added cells land in a single-source column.

So automation raised the floor without raising the ceiling. The pipeline now catches structure,
staleness, casing, units, provenance and cross-source contradiction. It cannot catch a source that
is internally consistent and means something other than the column it lands in — for that, someone
still has to open the page. Adding a second reading of a single-sourced benchmark is worth more
than adding a first reading of an uncovered one.

What "maintains itself" means concretely, every day, in `.github/workflows/upstream.yml`:

| Finding | Source kind | Verdict |
| --- | --- | --- |
| A published cell changed or vanished under a frozen version | pinned, append-only (LiveBench) | Integrity failure, job red, a human decides |
| A cell *appeared* under a frozen version | append-only (LiveBench) | New data → the batch is rewritten. A release freezes the question set, not the list of models run against it |
| A cell moved on a live board | live (DeepSWE, Epoch, Terminal-Bench) | New data → the batch is rewritten and a pull request opens |
| A newer release exists | pinned, append-only | Reported only. Collecting it changes 23 benchmark version fields and is a catalog decision |
| Anything never collected at all | any | The collection-gaps issue |
| A model appeared upstream that was not in yesterday's report | any | Pushed to WeChat via PushPlus, diffed against the previous issue body |
| A maker published a release post | `npm run probe:releases` | Reported, and pushed to WeChat when the title looks like a launch |
| Artificial Analysis measured a model the catalog lacks | `npm run aa:new` | Dispatches the AA refresh, which opens a pull request carrying the parameters **and a drafted catalog record** |

That last row is the one that used to be a person. AA is excluded from the daily refresh for a good
reason — it re-measures speed, latency and cost continuously, so a scheduled rewrite would fail
`check:models` every morning — but "not daily" had quietly become "somebody has to sit at a machine
with the API key", which was the last manual step between a model being published and a catalog
record existing. Qwen3.8 Max waited behind exactly that. The fix is to separate the two things AA
does: a re-measurement is noise, and a *new model appearing* is signal. Only the second triggers
anything, and what it triggers is the same on-demand workflow, dispatched by the daily job instead
of by a person.

**That fix was necessary and it was not sufficient, and Qwen3.8 Max is the case that showed why.**
The trigger only fires once AA's parameter API — the sole source of the intelligence index — has
measured the model, and three days after release it still had not. (AA is not one surface: its
GDPval-AA evaluation board added Qwen3.8 Max in the 2026-08-06 refresh while its parameter index
still had no row, so "AA has it" is a question that has to name which AA.) Until 2026-08-06
`ModelConfiguration.intelligence` was `number`, so the record could not be written at all: a model
with 36 fillable cells from LiveBench, Epoch, DeepSWE, ALE, GDPval-AA and the maker's own release
table was outside the catalog because one third party had not published a composite of its own. The field is now `number | null`: the general-capability lens reads `N/A`,
every other lens ranks the model normally, and the value lens — a ratio of intelligence to cost —
drops it the same way it already drops a model with no published cost per task. This is rule 1
applied to the catalog's own schema, which was the one place the codebase still required a number
it might not have. AA's index fills itself in later, on a normal refresh, with no code change.

What is left of the manual path is the part that should be manual — and it is now smaller than
that sentence used to imply, because the *easy half* of the alias step was measured and handed to a
gate on 2026-08-06.

`npm run propose:attribution` answers one question, "which catalog model is this published string",
and answers it only from evidence: the string is exactly a family after stripping a closed list of
effort tokens (tier 1), or its scores corroborate a family on two like-for-like cells or one
agreeing to within 0.2% (tier 2). Against the 239 mappings a human had already made it reproduces
127 and contradicts none, and it maps none of the 21 strings documented as deliberately unmapped.
That replay is a CI step, so the test set is the project's own history rather than a fixture.

Four of its refusals are worth reading as design, because each came from a measured false positive
rather than from caution:

| Refusal | The error it prevents |
| --- | --- |
| The family's version number must appear in the string | `gpt-5.6-sol` corroborated **`gpt-5.5`** — a generation splitting into Sol, Terra and Luna gives successors that score near the predecessor |
| Nothing may be left over after the family's own tokens | `gpt-5.5-pro-pre-release` agreed with GPT-5.5 to within 0.2% on a cell, and is neither GPT-5.5 nor a configuration of it |
| One source publishing a suffixed sibling | the DeepSeek V4 Flash case, where the bare string is the preview on three boards and the release on a fourth |
| A base carrying a file-scoped alias poisons its effort variants | `deepseek-v4-flash-thinking` strips to that same ambiguous base |

The gate never merges on its own authority. `scripts/attribute-and-merge.sh` applies its proposals,
runs the contract, and merges only when nothing moved — an alias should only ever *add* cells, so a
moved number means something attached to a cell that was already filled, and that is a person's
call. Its first live run produced exactly that outcome: attaching Claude Opus 4.8's and GPT-5.5's
effort-specific rows changed which row is primary in `arc-agi-2`, two published numbers moved, and
it left the pull request open instead of merging it.

The same run also produced the one rule that is not about attribution at all: the gate must be
closed under `check:models`' own equivalence. It mapped `GPT 5.5 (high)` and left `GPT-5.5 (High)`
behind, which is precisely the near-miss casing that check exists to catch.

What remains manual after this: the maker's price still has to be found — for Qwen3.8 Max it was on
the marketplace card three days before either list-price table carried it (batch 21) — the catalog
record itself is still hand-placed, and everything the gate escalates is judgement, which is the
whole argument of the alias mechanic in `docs/AGENT-OPERATIONS.md`.

`npm run draft:model` writes the record's numbers from the archive and leaves blank what nothing
sources — display name, colour, tags — with the reason next to each. It never writes to
`app/model-data.ts`: placing a record is a new mapping, and the reviewer's job is exactly the part
the draft cannot do.

The release probe exists because the other two detectors watch the wrong surface. `check:upstream`
asks whether an archived number moved; the namespace watch asks whether a provider started
*serving* a model. Neither looks at the page where a maker publishes its benchmark table — and that
table is where core cells come from: Qwen's carried twelve of them, four in columns that had no
archived source at all. It reports that a post exists and never reads a score, because deciding
which published label belongs in which catalog column is judgement.

Four modes, cheapest first: **feed**, **html** (server-rendered, links in the bytes), **render**
(browser, links), **render-cards** (browser, no links at all — Qwen's index is nine cards and one
anchor, and that anchor is the cookie notice). All eleven makers the catalog carries are readable.

Getting there took a second pass and a correction. The first pass declared four makers unreachable
and **all four were reachable**: xAI, DeepSeek and Z.AI publish release indexes on their
*documentation* hosts while their marketing sites block or redirect, and Qwen's index is at
`/research`, not `/blog`. When a maker's marketing site is shut, try its docs host. The correction
is about the staleness test itself — Z.AI was called stale because nothing appeared after June,
which is the wrong question. **An index is stale when it misses a release that happened**, not when
the maker has not released. `qwenlm.github.io` is stale by that test and `docs.bigmodel.cn` is not.

Feeds first, browser second, and both were necessary. OpenAI's HTML index answers headless Chrome
with a Cloudflare interstitial and zero links while its RSS answers 200 with the full list;
Anthropic publishes no feed at all and only renders. One trap is worth naming: `qwenlm.github.io` publishes a feed that parses cleanly, carries 44
entries, and stopped mirroring a generation ago. It is the same failure as `lmarena/arena-catalog`
— a source that decodes is not a source that is current.

Notification is separate from record-keeping because the two want opposite things. The gaps issue
is edited in place — it is a standing work queue, and a new issue every morning is a backlog nobody
reads. But **editing an issue body sends no notification**, which is why Qwen3.8 Max sat in that
issue from 2026-08-03 and the first person to notice was the owner, two days later, by asking.

**The channel was cut from ten push points to four on 2026-08-06, and the principle behind the cut
is the one worth keeping.** Six of the ten announced a *detection* — a board moved, a maker
published a post, Artificial Analysis measured something new, models appeared upstream, the gaps
issue was created, an automatic pull request opened. Every one of those now has a consumer that is
not a person: the gaps issue is read by the scheduled agent, the attribution gate resolves what
evidence can settle, and the pull request is its own record. A notification whose only possible
response is "yes, I saw it" trains the habit of not opening the next one — and this project needs
the next one opened, because two of the four survivors are alarms.

What remains:

| Push | Fires when | Why it survives |
| --- | --- | --- |
| `观测台 · 新增模型` | A push to `main` adds a catalog record | The event the owner asked for: the site gained a model, from any direction |
| `⚠ 观测台 · 归档完整性失败` | A frozen source rewrote a published number | The one signal the whole drift system exists to produce |
| `观测台 · 完整性恢复` | That failure cleared | Closes the loop on the alarm above |
| `⚠ 观测台 · AA 已刷新,PR 未创建` | Parameters were pushed to a branch but the PR could not open | Work that would otherwise be silently stranded |

The first is emitted by `ci.yml`, not the daily job, because a catalog record can land from the
attribution gate, from the scheduled agent, or from a hand-merged pull request — and all three end
in a push to `main`. `describe-change` marks the event with a `<!-- new-models: … -->` line so the
detection is a diff of the catalog rather than a guess about which workflow ran.

The Monday heartbeat went with the rest, and that is a real trade the owner made explicitly:
silence is no longer diagnosable from the phone. A stalled pipeline now shows up as an empty
Actions history rather than as a missing message. `PUSHPLUS_TOKEN` is a repository secret and, like
`AA_API_KEY`, is optional everywhere: without it every check still runs and the reports still land
in their issues.

The refresh is idempotent: an unchanged board writes nothing, not even a new `retrievedDate`, so
a quiet week produces no pull request. And the pull request carries its own check output, because
one opened with `GITHUB_TOKEN` does not trigger CI — GitHub blocks that to prevent recursion.
Push any commit to the branch to get a real CI run.

Two consequences worth keeping in mind. A live board means the archive is *expected* to change,
so DeepSWE's numbers are only as frozen as the last merge — read `evaluation_date`, not the
retrieval date, when comparing it to a transcribed source. And auto-collecting a new LiveBench
release is deliberately **not** automated: the release changes the question set, so it would need
23 `BenchmarkRecord` version fields updated and a decision about whether the old release's rows
stay. That is judgement, and judgement does not go in a cron job.

- **The coverage floor names its own collection targets, and now says so out loud.** Since a
  portfolio score needs half an axis (§5), a model sitting one cell short is one observation away
  from entering a ranking, and the axes are small enough that single benchmarks unlock many models
  at once. `npm run report:gaps` computes this from the same floor the dashboard publishes with —
  never a second copy of the rule — so the counts are current by construction rather than
  transcribed into this document and left to rot. As of 2026-08-01 it ranks `hle-no-tools` first
  (would admit 11 models), then `apex` (8), `arc-agi-2` (7), `mrcr` and `aa-lcr` (6 each).
- **What has never been collected is now reported too, which is the other half of drift.**
  `check:upstream` asks whether an archived number moved; it cannot ask what exists that was never
  archived. `report:gaps` does: archived rows still waiting on a catalog model (678 rows across
  246 published model strings, with the batch each appears in as the triage signal — a string in
  the current LiveBench release is a live model, one that appears only in an older transcription
  is almost always previous-generation), and models published in a namespace the catalog already
  tracks. The watched namespaces are **measured, not declared** — they are whichever providers the
  catalog's own price lookups resolve into, so adding a lab to the catalog adds it to the watch
  list with no second list to maintain.
- Upstream diffing still exists only for sources with a machine-readable feed. LiveBench is
  re-fetched and compared cell by cell (`npm run check:upstream`, daily in CI). **Measured
  2026-08-07: 12 scripted batches carry 3,381 archived rows and 13 transcribed ones carry 1,749,
  so 65.9% of the archive re-reads itself and the other third is undiffable** — nothing tells you
  that Vals or the Qwen release table edited a number after it was archived. Ranked by rows at
  risk the undiffable ones are `batch-05-independent` (538), `batch-17-qwen3.8-release` (465) and
  `batch-02-coding` (313), which is the order worth attacking them in. Each source that gains a fetcher gains a drift check.
  Until then, how long ago a source was last read is the only honest freshness signal there is,
  which is why every source card now prints it and marks itself aging after
  `SOURCE_STALE_DAYS` (30). The card prints *read* or *evaluated* and never blurs the two: a
  recently-read source with an old evaluation date is not stale, its leaderboard is quiet.
- Four catalog values still have no archive row: Claude Opus 4.8's code Elo, Qwen3.7 Plus's context
  window, and the open-weights flag on Qwen3.7 Plus and Qwen3.8 Max. `npm run check:models` lists
  them. The two flags are the same gap: no source consulted states the weights status either way,
  and absence of a weights repository is not a published fact, so the catalog carries the
  conservative `false` and the audit keeps saying it is unsourced. Grok 4.3's two Elo figures left this list without
  new collection: batch 09 added a lowercase `grok-4.3` alias, which attached LMArena rows that
  had been sitting in the archive unmatched. Check for an orphaned row before collecting again.
- **The catalog quotes list price, never a promotion.** A temporary discount is not comparable
  against every other model's list price, and it goes stale silently the day it lapses — so
  Claude Sonnet 5 is carried at its standard $3/$15 rather than the $2/$10 introductory rate
  that runs to 2026-08-31. The promotion stays archived because it is a real published fact, but
  a promotional row can no longer back a price check (`check-model-provenance.mjs` excludes it,
  the same way it excludes an Arena price), and `npm run check:prices` fails if one ever reaches
  a catalog record. Only the Sonnet 5 promotion is recorded as a `priceTerms` entry so far; the
  other tier notes in batch metas are still prose.
- Vendors also price in tiers and regions and the catalog quotes one. Google publishes Standard,
  Batch, Flex and Priority; Alibaba publishes six regions. The tier archived is recorded in each
  batch's meta.
- 704 archived rows are not ingested because the catalog has no model for them, almost all
  previous-generation. They are kept deliberately: adding the model is all it takes for
  `npm run ingest` to attach them, with no code change.
- Three benchmarks are still empty: `swe-evo` (no leaderboard exists), `videommmu` (newest
  entry is Claude 3.5 Sonnet) and `mmlu-pro` (Vals has rows but labels the version by year, which
  cannot be matched to the catalog's). `frontiermath-t4` left this list; it is thin, not empty.
- Cell coverage, not source count, is the metric that matters. `npm run check:data` prints
  filled cells and the benchmark/independent/vendor split on every run; adding a source card
  without adding rows moves neither number.
- Model identity was the ingestion bottleneck and is now resolved: the catalog holds one
  record per family and effort lives on the observation row. Ingestion rose from 179 to 214
  rows on the same archive when this changed, because leaderboards publish one line per
  model, not one per effort.
- Live price matching now uses exact provider ids and no longer overwrites the catalog (§6). What
  remains is judgement, not code: 10 of 27 models disagree with their provider today, and each one
  is either a vendor price change to collect or a rate the catalog deliberately excludes — a
  promotion, a reseller margin, a regional tier. Nothing tells them apart automatically, and
  nothing should.
- Pixel regression testing is not yet in CI. Add Playwright screenshots only after a stable public
  preview URL and baseline approval exist. `npm run check:mobile` covers the part that regresses
  silently — overflow, type floor, tap-target floor — and **is** in CI since 2026-08-07, on both
  routes, using the Chrome the runner already ships.
- General capability values are imported composite snapshots, not recomputed from the benchmark portfolio.
- **A refusal is now written down rather than made invisible.** Ten Artificial Analysis fields were
  refused at the fetch layer, which meant 2,225 published numbers existed nowhere in this
  repository — and a refusal nobody can audit is not a refusal, it is a gap that looks like a
  decision. They are archived now under AA's own field names and blocked at ingest by
  `droppedBenchmarks`, each with its reason: `terminalbench_hard` (AA withdrew it), `tau2` (in
  neither the methodology nor the leaderboard), `mmlu_pro` (AA states no version and the column
  declares 2025), `livecodebench` (the column is Vals' harness), and AIME / AIME-25 / MATH-500 (no
  column, and adding one is a taxonomy decision). The board did not move by a single cell.
  **Still not collected: ARC's public splits.** 363 rows, and the only ones where archiving carries
  risk without reward — the public eval runs ~11 points above the verified board under the same
  benchmark name, so it corroborates nothing and sits one alias mistake from the `arc-agi-2` column.
- **The catalog record is no longer only hand-placed.** `scripts/add-model-and-merge.sh` adds one
  for an upstream model that clears four conditions, and the fourth is the reason it can be
  unattended at all. Two bugs of its own were caught by building the failure rather than reasoning
  about it: its first run proposed Claude Sonnet 4.6 and GPT-5.2 — both deliberately absent, one
  with 36 cells of real evidence — because the recency window `report:gaps` has always applied was
  missing; and its first write produced a casing near-miss (`Muse Spark 1.2 (xhigh)` written,
  `muse-spark-1.2 (xHigh)` left unmapped) that `check:models` fails on, because it scanned only
  observation batches. Both are in the script headers. Today nothing qualifies, which is the
  expected steady state.
- ~~The three conditions do not protect against an empty row~~ **Closed 2026-08-07 by a fourth
  condition**: `describe-change` now counts, for every newly added catalog record, the cells it
  actually brings and compares them against the board's own average, and emits
  `new-models-below-floor`. The measurement that made the case is below and still stands —
  the three contracts really are green on an empty record, so the fourth condition is the only
  thing that speaks.
- **The three contracts do not protect against an empty row, and what used to catch it was
  incidental.** Measured 2026-08-07 by putting a zero-evidence catalog record in and running the
  contract: `check:data` passed, `check:models` exited **0**, `check:prices` passed. All three
  contracts are green on a model with no evidence at all, because none of them asks "does this
  record have any rows". What refuses the merge is that `describe-change` counts a new catalog
  record in its `moved` tally, so `moved=1` and condition 2 fails — a side effect of how the report
  is written, not a gate anybody designed for this. The real protection is the sentence in
  `docs/AGENT-OPERATIONS.md` telling a reader to check for rows first, and a sentence is not a gate.
  If new-model automation is ever built, the missing condition is explicit: **a record needs
  archived rows before it is allowed to exist**, and the count has to be measured on unaliased
  strings, because `check:models` exits 1 on an alias naming a catalog id that is not there — so
  the record must precede the alias and "rows already resolving to it" is zero by construction.
- ~~`npm run check:mobile` is not in CI~~ **Closed 2026-08-07.** It was the only one of the seven
  contract commands not in CI, which made it the only one that depended on somebody remembering —
  on `/models`, the route whose table went from 68 columns to 72 in a day. It now runs on every
  push and pull request, against both routes, and **fails the job rather than skipping itself** if
  the runner has no Chrome: a layout check reporting green for a probe that never ran is worse than
  no layout check. What is still not covered is pixel regression, above.
- ~~Nothing verifies the deployed site~~ **Mechanism built 2026-08-07, waiting on one fact.**
  `npm run check:deployment` fetches `/models` from production, follows every `<script src>` it
  names, and looks for every catalog benchmark and model name in the concatenated bundle. The
  obvious check — "does the page show the new benchmark" — does not survive contact with the page:
  it is a client component whose catalog is collapsed, so the prerendered HTML carries 22 of 72
  names and headless rendering gives 6,345 characters of body text, still 49 short. The data does
  not depend on any of that; it is compiled into the chunks. Verified both ways against a local
  production build: 9 chunks, 1.5MB, every name present, and a name added without rebuilding is
  correctly reported missing. It runs in the daily job and reports into the gaps issue rather than
  failing, because a stale deployment is a fact somebody needs and not a reason to abandon the
  archive refresh. **What it still needs is the production URL**, which is recorded nowhere in this
  repository — that absence is itself part of why nothing verified the deployment. Until
  `data/deployment.json` names it, the check reports itself as unrun, every day, in the issue.
  The coupling still runs the other way too: a type error in the personal site at `/` fails the
  build step that gates the daily data refresh.
- **The two schedulers watch each other asymmetrically.** GitHub dying is pushed to WeChat by
  hermes. hermes dying is written into the gaps issue and the step summary only — and that issue is
  mostly read by hermes. On top of that `check-heartbeat --agent` deliberately cannot tell the agent
  from the owner (both push as a person, and the comment says so), so it answers "is the queue being
  worked", not "is hermes alive": an owner session resets its three-day clock. Both are defensible
  as written; together they mean a dead hermes is the one failure with no push behind it.
- **The generated observation store has a compiler ceiling, and the archive walked into it on
  2026-08-07.** `ObservationRow` carries four optional properties, so every emitted row literal has a
  slightly different shape and TypeScript checks the array by building a union across all of them. Past
  roughly 1,120 rows that union stops being representable and `npm run build` fails with *Expression
  produces a union type that is too complex to represent*, pointing at line 6 of a generated file — which
  reads as corruption rather than as growth. Attributing the ARC batch took the store from 1,116 rows to
  1,138 and tripped it; 1,113 still passed, so the daily refresh was days from finding it instead.
  `scripts/ingest.mjs` now emits chunks of 300 typed `ObservationRow[]` and spreads them, which caps the
  union at chunk size and stops the ceiling moving with the archive. One row is still one line, which
  `scripts/describe-change.mjs` parses on.

## 11. Interface

`docs/UI.md` is the contract for everything between the data and the screen: the two type scales,
the four breakpoints, the six guarantees the phone layout makes, and how to verify a layout change
without trusting a screenshot taken the wrong way.

The short version. The desktop layout is a 72px rail plus a workspace of six sections. Below
800px the rail becomes a labelled bottom bar, the header goes static, section heads stack so their
control gets the full width, and ranking rows become cards carrying a three-metric strip. Nothing
renders below 9px, no control is under 36px, wide content lives in a named scroller with
`overscroll-behavior-x: contain`, and every fixed element pads itself with a safe-area inset.

Two traps are worth repeating here because both fail silently: `overflow:hidden` on a panel turns
it into a scroll container and kills `position:sticky` inside it (use `overflow:clip`), and
headless Chrome without device emulation ignores the viewport meta tag and invents overflow that
no phone shows.
