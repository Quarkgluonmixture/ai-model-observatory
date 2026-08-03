# AI Model Observatory — Agent Handoff

Read `docs/ARCHITECTURE.md` before making structural or data changes.

**If you are an agent running on a schedule, read `docs/AGENT-OPERATIONS.md` as well.** It says
what may be done unsupervised, what must be handed back for approval, and the five mistakes that
have already been made here — all of which passed every automated check.

## Two sites share this repo

- **`/` is the owner's personal site** (job-hunting portfolio). Its files are `app/page.tsx`,
  `app/home-content.ts`, `app/home.module.css`, `public/shots/`. Copy lives in
  `home-content.ts`; the wording rules and the fuller source of truth are in
  `../quark-space/content/projects.json`.
- **`/models` is the observatory** — `app/models/page.tsx` (+ `app/models/layout.tsx` for its
  title, since the page is a client component). Everything else in this file is about the
  observatory.
- The personal site touches **no** data file: not `data/sources/`, not
  `observations.generated.ts`, not `model-data.ts`. Changing it does not require
  `check:data` / `check:models` / `check:prices` — only `lint` and `build`.
- It must never put styles in `app/globals.css`. That file owns the observatory's phone
  contract (type floor, tap targets, safe areas — `docs/UI.md`). The personal site is scoped
  under `.home` in its own CSS module with `--h-*` prefixed properties, because globals.css
  styles bare elements (`header`, `h1`) and hangs `--ink` / `--sans` / `--mono` on `body`.
- ⚠ Any observatory number quoted on the personal site is a **copy**, and copies go stale. Re-run
  `check:data` and `check:models` and update `home-content.ts` before publishing. This already
  bit once: the page shipped 27 models / 1,162 observations / 49.1% when the real values were
  28 / 1,154 / 47.4%.

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
9. Preserve Chinese/English UI parity and mobile behaviour. The phone contract — type floor, tap
   targets, scrollers, safe areas — is in `docs/UI.md`; read it before touching `app/globals.css`.
10. A portfolio average is only published above the coverage floor: half of that axis's core
    benchmarks, minimum two. Thin evidence reads `N/A`, it does not rank.
11. GitHub `main` is the source of truth, EdgeOne Pages is the production host. Do not create
    a second production deployment unless asked.

## Required checks

```bash
npm ci
npm run ingest        # rebuilds app/observations.generated.ts from data/sources/
npm run lint
npm run check:data    # observation contract + coverage report
npm run check:models  # every catalog number vs the source archive
npm run check:prices  # a promotional price that reached the catalog
npm run build
```

`npm run check:upstream` re-reads every scripted source and diffs it cell by cell. It needs the
network, so it runs daily rather than on every PR — see `.github/workflows/upstream.yml`. It
fails only when a **pinned** source moved under a frozen version; a **live** board moving is new
data, and the same daily workflow rewrites that batch and opens a pull request instead.

`npm run report:gaps` asks the opposite question: what exists that was never collected. Models one
cell below a ranking floor, archived rows still waiting on a catalog model, and models published
in a namespace the catalog already tracks. **It never fails** — an uncollected model is not a
defect in your commit — so it prints a report and the scheduled job turns it into one self-updating
issue. Run it before deciding what to collect next; `--no-network` skips the upstream section.

`npm run check:mobile` probes the built site at 320 / 390 / 430px under real device emulation and
fails on horizontal overflow. It needs Chrome and `PORT=3111 npm run start:next`, so it is a local
gate. Run it after any layout change — and never judge mobile from a headless screenshot taken
without emulation, which ignores the viewport meta tag and invents overflow.

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
UNAVAILABLE because the page renders client-side — but the page fetches its own CSV and JSON.
DeepSWE was transcribed by eye into 18 rounded rows while the page was loading a JSON artifact
with all 50 configurations at full precision. A scripted batch beats a transcribed one on every
axis that matters here: no row limit, no transcription error, re-running it *is* the drift check,
and a live board can then refresh itself into a pull request. A leaderboard that "cannot be
scraped" is often a leaderboard whose data file nobody looked for.

**But do not go looking blind, and do not stop at the landing page.** Every source was probed
twice on 2026-08-01 and the verdicts are in `docs/ARCHITECTURE.md` §9. The first pass only searched
each page's HTML and missed the two biggest wins in the archive: Epoch AI publishes its entire
benchmark hub as a ZIP the page never links, and Terminal-Bench answers a function call that only
appears in its client's source. **Where the data lives is not always where the page is.**

Three failure modes that pass a naive check, all hit for real:
- **A live 200 with plausible JSON is not verification.** Hugging Face's
  `/api/datasets/{id}/leaderboard` answers for many benchmarks; every record is a vendor
  self-report scraped from a model card, with no version, harness, effort or date.
- **A working mirror can be silently stale.** `lmarena/arena-catalog` decodes cleanly and stopped
  syncing a generation ago. Check that a source knows about models you already carry.
- **An official file can be the wrong split.** ARC's public-eval JSON runs ~11 points above the
  verified board it would have been filed under.

To add a scripted source: write `scripts/fetchers/<id>.mjs`, list it in `scripts/fetchers/index.mjs`,
and declare `versioning`. `"pinned"` means the source freezes a version and any movement is an
integrity failure; `"live"` means it appends results and movement is new data. Getting that wrong
either turns the daily job permanently red or silently accepts a rewritten history.

## Adding a model

Model records are hand-authored because they also carry editorial content — inclusion,
display name, colour, tags, ordering — that has no source to generate from. Every *number*
on them is audited instead: `npm run check:models` fails when a catalog value contradicts
`data/sources/`, and reports how many values have no archive row at all. It audits 314 values —
including context window and open-weights status, which nothing checked until one of them turned
out to be inventing an open model — and it fails on a `model_raw` that differs from an existing
alias only in casing, because alias resolution is case-sensitive and such a row is silently
dropped from ingest.

So: put the operating parameters in the archive first, then write the record. For a model
Artificial Analysis already covers, that is one command — and batch 14 keeps AA's **whole** list,
not just catalogued models, so a model you are about to add usually has its numbers archived
already. `npm run check:models` then tells you if what you typed disagrees with them.

`AA_API_KEY` is read from the environment and belongs in a GitHub secret, never in a file. It is
optional everywhere: without it the AA source skips itself and every other check still runs.

Field sources are fixed:

| Field | Source |
| --- | --- |
| intelligence, cost per task, speed, latency | Artificial Analysis — now scripted: `AA_API_KEY=… npm run fetch:sources aa` archives them with provenance before you write the record |
| price | official vendor page, else Artificial Analysis — **list price, never a promotion** |
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
- **A substring lookup will find the wrong model, and a wrong price looks exactly like a right
  one.** `list.find(id => id.includes("gpt-5.6"))` returned `openai/gpt-5.6-luna-pro`, so the
  GPT-5.6 Sol price card rendered $0.10/$0.60 instead of $5/$30 — and six other lookups landed on
  a `-fast`, `-pro` or `-lite` variant. Provider ids in `PROVIDER_LOOKUPS` are exact, and the live
  feed compares against the archived price rather than overwriting it. A number that arrives at
  runtime has no archive row behind it, so it can never be a catalog number.

## High-value files

| Path | What it is |
| --- | --- |
| `data/sources/*.jsonl` | Raw transcription archive — evidence, append-only |
| `data/model-aliases.json` | Every editorial decision, each with a reason |
| `scripts/ingest.mjs` | Archive + aliases → `app/observations.generated.ts` |
| `scripts/check-model-data.mjs` | Observation contract, enforced in CI |
| `scripts/check-model-provenance.mjs` | Catalog numbers vs the archive |
| `scripts/fetchers/*.mjs` | One module per source that can be re-read by script |
| `scripts/fetch-source.mjs` | Runs them; `--check` diffs, `--live` refreshes the moving boards |
| `scripts/report-gaps.mjs` | What was never collected — floors, unaliased rows, new upstream models |
| `scripts/check-price-terms.mjs` | Fails when a promotional price reaches the catalog |
| `app/model-data.ts` | Model catalog, benchmark taxonomy, derived views |
| `app/observations.generated.ts` | Generated — never hand-edit |
| `app/page.tsx` | Rankings, coverage semantics, radar, bilingual UI |
| `app/globals.css` | Visual system, type scale, breakpoints, phone layout |
| `scripts/check-mobile.mjs` | Layout probe: overflow, type floor, tap-target floor |
| `docs/ARCHITECTURE.md` | Architecture, data policy, collection state, next work |
| `docs/UI.md` | Type scale, breakpoints, phone contract, layout verification |
| `docs/AGENT-OPERATIONS.md` | Standing instructions for a scheduled agent: risk tiers, hard rules, traps |
| `docs/INGEST-PROMPT.md` | Transcription contract for collecting new rows |

## Safe change sequence

1. Add evidence to `data/sources/` before touching anything in `app/`.
2. Record the editorial call in `data/model-aliases.json` with its reason.
3. `npm run ingest` and read the skip report, or `npm run report:gaps` for the same thing ranked
   by what it would unlock — both tell you what the catalog is missing.
4. Run every required check.
5. Review desktop and mobile on the EdgeOne preview URL; run `npm run check:mobile` for layout.
6. Update `README.md` counts and `docs/ARCHITECTURE.md` if behaviour or schema changed.
