# AI Model Observatory — Agent Handoff

Read `docs/ARCHITECTURE.md` before making structural or data changes.

## Mission

Maintain a bilingual, mobile-first AI model observatory with honest evidence semantics. The
dashboard must separate model capability, best-system performance, human preference, speed
and price rather than hiding them inside one universal score.

The metric that matters is **cell coverage** — filled `model × benchmark` cells and the
benchmark / independent / vendor split. Adding a source card to the README moves neither.
`npm run check:data` prints both on every run.

## Non-negotiable rules

1. Missing benchmark evidence is `N/A` / `Not ingested`, never numeric zero.
2. Every score originates from an observation row carrying source, version, date, harness,
   reasoning effort and tool setting where known.
3. Source precedence: benchmark-native leaderboard > independent evaluator > vendor release
   material. Vendor tables may fill gaps but never become the standard.
4. Never merge incompatible benchmark versions, context lengths, tool settings or harnesses.
5. Arena Elo is human preference, not task accuracy. Keep it out of capability tables.
6. System benchmarks reflect model + scaffold + tools + budget. Keep model and best-system
   views distinct.
7. **One catalog record per model family.** Reasoning effort belongs on the observation row
   and in `configurations`, never in a model id. See "Model identity" below.
8. **Never guess an attribution.** A row whose model string has no alias is skipped and
   reported. That is the intended outcome, not a failure to paper over.
9. Preserve Chinese/English UI parity and mobile behaviour.
10. GitHub `main` is the source of truth, EdgeOne Pages is the production host. Do not create
    a second production deployment unless asked.

## Required checks

```bash
npm ci
npm run ingest        # rebuilds app/observations.generated.ts from data/sources/
npm run lint
npm run check:data    # observation contract + coverage report
npm run check:models  # every catalog number vs the source archive
npm run check:prices  # a quoted price that outlived its published end date
npm run build
```

`npm run check:upstream` re-fetches an archived source and diffs it cell by cell. It needs the
network, so it runs weekly rather than on every PR — see `.github/workflows/upstream.yml`.

CI runs all of these, and additionally fails if `app/observations.generated.ts` differs from
a fresh `npm run ingest` — the generated file must never be hand-edited.

## Model identity

An id like `gpt-5.6-terra-max` cannot receive a leaderboard line that says only
`GPT-5.6 Terra` without someone guessing which effort was meant. So the catalog holds one
record per family, and each record carries `configurations` — the published operating points,
strongest first. Top-level `intelligence` / `speed` / `price` are derived from
`configurations[0]` so rankings read one number per model.

This is not cosmetic: collapsing 22 effort-specific records into 17 families raised ingestion
from 179 to 214 rows on an unchanged archive.

## Adding benchmark data

Never hand-write a score into `app/model-data.ts`.

1. Append the raw rows verbatim to `data/sources/batch-NN-*.jsonl`, plus a sibling
   `.meta.json` recording `retrievedDate` and whether the batch was filtered at capture.
2. Record the mapping decision in `data/model-aliases.json`, each with a written reason.
3. `npm run ingest`, then the rest of the checks.

`docs/INGEST-PROMPT.md` is the transcription contract to hand a browsing model. It is written
to be pasted whole, one batch at a time.

**Check for a data file before hiring a transcriber.** Batch 05 recorded LiveBench as
UNAVAILABLE because the page renders client-side — but the page fetches its own CSV and JSON,
and `scripts/fetch-livebench.mjs` reads those directly. A scripted batch beats a transcribed one
on every axis that matters here: no row limit, no transcription error, and re-running it *is* the
upstream drift check. A leaderboard that "cannot be scraped" is often a leaderboard whose data
file nobody looked for.

## Adding a model

Model records are hand-authored because they also carry editorial content — inclusion,
display name, colour, tags, ordering — that has no source to generate from. Every *number*
on them is audited instead: `npm run check:models` fails when a catalog value contradicts
`data/sources/`, and reports how many values have no archive row at all.

So: put the operating parameters in the archive first, then write the record.

Field sources are fixed:

| Field | Source |
| --- | --- |
| intelligence, cost per task, speed, latency | Artificial Analysis |
| price | official vendor page, else Artificial Analysis |
| text / code Elo | LMArena |

LMArena's price column is not used as a price source — it states no tier or region, so it
cannot be reconciled with a vendor page that prices Standard, Batch and Priority differently.
It is **not** unreliable: batch 06 concluded it was, on the grounds that it disagreed with the
catalog on Claude Fable 5 and GPT-5.5. Batch 08 showed the catalog was the stale one. Prefer
official pages for precision, not because LMArena is wrong.

## Traps this project has already hit

- A cell can legitimately hold several rows (harness, effort, tools, context length). The
  table shows the primary and marks the rest `+n`. Do not deduplicate them away.
- Two benchmark versions in one cell means one model's version gets compared against
  another's. `check:data` fails on it; give the second version its own benchmark id.
- Vendor numbers run high on **system** benchmarks (up to +8 points on Terminal-Bench) but
  match on **model exams**. Do not "fix" a benchmark-native number toward a vendor one.
- Sources publish a tool list where a boolean belongs, and a model string that is not a model
  at all (`Multiple`, `Best per task`). Both are handled; see `data/model-aliases.json`.
- When a catalog number and a source disagree, check which one has a source before assuming
  the source is wrong. Batch 08 corrected 43 catalog values this way, including two prices
  that had been used as evidence *against* a source.
- Vendors price in tiers and regions. Archive the tier the catalog quotes and record the
  others in the batch meta, so a later reader does not "correct" Standard to Batch.

## High-value files

| Path | What it is |
| --- | --- |
| `data/sources/*.jsonl` | Raw transcription archive — evidence, append-only |
| `data/model-aliases.json` | Every editorial decision, each with a reason |
| `scripts/ingest.mjs` | Archive + aliases → `app/observations.generated.ts` |
| `scripts/check-model-data.mjs` | Observation contract, enforced in CI |
| `scripts/check-model-provenance.mjs` | Catalog numbers vs the archive |
| `scripts/fetch-livebench.mjs` | Fetches batch 09; `--check` diffs the archive against upstream |
| `scripts/check-price-terms.mjs` | Fails when a quoted price outlives its published end date |
| `app/model-data.ts` | Model catalog, benchmark taxonomy, derived views |
| `app/observations.generated.ts` | Generated — never hand-edit |
| `app/page.tsx` | Rankings, coverage semantics, radar, bilingual UI |
| `docs/ARCHITECTURE.md` | Architecture, data policy, collection state, next work |
| `docs/INGEST-PROMPT.md` | Transcription contract for collecting new rows |

## Safe change sequence

1. Add evidence to `data/sources/` before touching anything in `app/`.
2. Record the editorial call in `data/model-aliases.json` with its reason.
3. `npm run ingest` and read the skip report — it tells you what the catalog is missing.
4. Run every required check.
5. Review desktop and mobile on the EdgeOne preview URL.
6. Update `README.md` counts and `docs/ARCHITECTURE.md` if behaviour or schema changed.
