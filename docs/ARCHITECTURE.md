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
2. Best-effort live price refresh through `app/api/live-models/route.ts`, with bundled prices
   retained when the upstream call fails.

Current scale: **27 model families, 45 benchmarks, 442 observations across 312 of 1215 cells**,
sourced benchmark-native 138 / independent 127 / vendor 177. 67% of catalog numbers are backed
by an archive row.

## 2. Repository map

| Path | Responsibility |
| --- | --- |
| `app/model-data.ts` | Model metadata, benchmark taxonomy, observations, derived scores, source cards |
| `app/page.tsx` | Client state, rankings, coverage, radar, line charts, tables, language switching |
| `app/api/live-models/route.ts` | OpenRouter price/context lookup and short-lived cache |
| `app/globals.css` | Light visual system and responsive layout |
| `data/sources/*.jsonl` | Append-only raw transcription archive, one row per published result |
| `data/model-aliases.json` | Every editorial decision: model mapping, benchmark splits, version and source-class overrides |
| `scripts/ingest.mjs` | Archive + aliases → `app/observations.generated.ts` |
| `docs/INGEST-PROMPT.md` | The transcription contract given to a browsing model |
| `scripts/check-model-data.mjs` | Observation contract enforced in CI |
| `scripts/check-model-provenance.mjs` | Audits every catalog number against the archive |
| `.github/workflows/ci.yml` | Lint, data contract, and production build checks |
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

Values in the archive are never altered, but a batch may be **filtered at capture**: batches
02-04 kept the 2026-era frontier rows and dropped the long tail of pre-2026 models the
catalog will not track. Each batch's `.meta.json` records `filtered`, the rule used, and the
source URLs, so a fuller re-transcription can be dropped in later — `npm run ingest` picks
up whatever the files contain, with no code change.

`data/model-aliases.json` carries four kinds of decision, each with a written reason:

| Key | Decides |
| --- | --- |
| `aliases` | which published model string is which catalog model, at which effort |
| `benchmarkSplits` | when a published "version" is really a different problem set |
| `versionAliases` | when two sources spell the same version differently |
| `sourceKindOverrides` | when a page's source class is not what it looks like |

The last one is not cosmetic. Epoch AI's FrontierMath page is benchmark-native because
FrontierMath is Epoch's own benchmark; Epoch's GPQA page is an *independent* evaluation,
because GPQA belongs to someone else and Epoch is a third party running it.

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
- Coding system: available core system-level coding observations.
- Agent system: available core system-level agent observations.
- Human preference: Arena Elo.
- Speed: output tokens per second.
- Value: current capability/cost heuristic.

These lenses answer different questions and must not be silently blended.

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
    EO->>EO: Call OpenRouter or return 503
    User->>User: Keep bundled snapshot on failure
```

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
npm run build
```

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
- retention of a known official Gemini 3.5 Flash observation as a regression guard.


## 9. Collection state

Seven archive batches, all under `data/sources/`. Read this before re-running a source: several
pages are known-dead or known-empty and were already worked around.

| Batch | Covers | Outcome |
| --- | --- | --- |
| 01 | Reasoning and maths | ARC Prize, Epoch FrontierMath + GPQA. Complete transcript. |
| 02 | Coding and software engineering | Terminal-Bench 2.0/2.1, SWE-bench, SWE-Bench Pro, DeepSWE, SWE-Marathon, FrontierSWE, PostTrainBench, ProgramBench. Complete, 313 rows. |
| 03 | Agents and tool use | MCP-Atlas, Toolathlon, OSWorld 2.0, Agents' Last Exam. Filtered at capture. |
| 04 | Multimodal, long context, professional | GDPval-AA, APEX, MMMU. Lowest yield of the set. |
| 05 | Independent evaluators | Vals AI sub-benchmarks, LMArena. Complete, 538 rows. |
| 06 | Model operating parameters | AA model pages, vendor pricing, LMArena Elo. |
| 07 | AA leaderboard main table | Cost per task, which batch 06 could not reach. |

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

Deliberately not carried, with reasons in `droppedBenchmarks`: LMArena text Elo as a benchmark
(383 rows — it is a preference lens and already lives on the model record), the Artificial
Analysis and Vals composite indices (they double-count their own components), and a few
Vals benchmarks with one to three rows.

Rows whose source publishes **no benchmark version** are archived but not ingested. This
currently costs SWE-Marathon, PostTrainBench and ProgramBench. It is deliberate: ProgramBench's
official Resolved score for GPT-5.5 is 0.5% while the Kimi vendor table reports 70.8 for the
same cell, so those columns would silently mix two different metrics.

## 10. Known limitations and next work

- Upstream diffing is still manual. The pipeline re-ingests deterministically, but nothing
  yet tells you that a leaderboard changed a number after it was archived.
- A third of the catalog's numbers still have no archive row: 22 speed, 22 latency, 28 price
  and a handful of index values. They cluster on pre-batch-06 models and on the vendor pricing
  pages that were never fetched — Anthropic, Google, xAI, DeepSeek and Alibaba. Batch 06 only
  reached OpenAI, Moonshot, MiniMax, xAI and Cursor. `npm run check:models` lists every one,
  so the next round has a precise target rather than a re-crawl.
- 929 archived rows are not ingested because the catalog has no model for them, almost all
  previous-generation. They are kept deliberately: adding the model is all it takes for
  `npm run ingest` to attach them, with no code change.
- Four benchmarks are still empty: `swe-evo` (no leaderboard exists), `videommmu` (newest
  entry is Claude 3.5 Sonnet), `mmlu-pro` (Vals has rows but labels the version by year, which
  cannot be matched to the catalog's) and `frontiermath-t4` beyond the models already covered.
- Cell coverage, not source count, is the metric that matters. `npm run check:data` prints
  filled cells and the benchmark/independent/vendor split on every run; adding a source card
  without adding rows moves neither number.
- Model identity was the ingestion bottleneck and is now resolved: the catalog holds one
  record per family and effort lives on the observation row. Ingestion rose from 179 to 214
  rows on the same archive when this changed, because leaderboards publish one line per
  model, not one per effort.
- Live price matching is substring-based and should eventually use canonical provider model IDs.
- Pixel regression testing is not yet in CI. Add Playwright screenshots only after a stable public preview URL and baseline approval exist.
- General capability values are imported composite snapshots, not recomputed from the benchmark portfolio.
