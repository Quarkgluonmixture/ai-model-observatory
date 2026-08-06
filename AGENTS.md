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
  28 / 1,154 / 47.4%. Re-check before publishing: as of 2026-08-06 the real values are
  29 / 1,263 / 48.4%.
- ⚠ **The coupling runs the other way too.** The daily refresh in `.github/workflows/upstream.yml`
  runs `npm run build` before it will commit or open a pull request, and that build now includes
  the personal site. A type error in `app/page.tsx` therefore blocks the data refresh — nothing
  reaches `main`, and no PR is opened either. Failing closed is right, but know the direction:
  the portfolio can stop the pipeline. Send personal-site changes through a pull request and read
  CI before merging; EdgeOne publishes on merge regardless of what CI said.
- `scripts/check-mobile.mjs` defaults to `/models` for this reason — pointed at `/` it would pass
  on the personal site while a phone regression sat one route over. Pass a URL to probe `/`.

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
fails only when an **already-published number** moved under a frozen version; a **live** board
moving, and an **append-only** board gaining a row it never had, are both new data, and the same
daily workflow rewrites that batch and opens a pull request instead.

`npm run report:gaps` asks the opposite question: what exists that was never collected. Models one
cell below a ranking floor, archived rows still waiting on a catalog model, and models published
in a namespace the catalog already tracks. **It never fails** — an uncollected model is not a
defect in your commit — so it prints a report and the scheduled job turns it into one self-updating
issue. Run it before deciding what to collect next; `--no-network` skips the upstream section.

`npm run check:mobile` probes the built site at 320 / 390 / 430px under real device emulation and
fails on horizontal overflow. It needs Chrome and `PORT=3111 npm run start:next`, so it is a local
gate. Run it after any layout change — and never judge mobile from a headless screenshot taken
without emulation, which ignores the viewport meta tag and invents overflow.

**Stop that server when you are done.** Nothing here stops it for you, and it holds `node_modules`.
One left running on 2026-08-01 was still holding the directory four days later, where it surfaced
as an `npm ci` failure on a different machine's first run — packages on disk, `.bin` shims never
linked, so every `node` script passed and `lint` and `build` reported `not found`.

CI runs all of these, and additionally fails if `app/observations.generated.ts` differs from
a fresh `npm run ingest` — the generated file must never be hand-edited.

Three of the contract's failures exist because a *report* was not enough. `check:data` printed
`deepseek-v4-flash/critpt: 7.14 vs 16.57` every day for a week while the live site showed a
preview release's Arena score under the name of the model that replaced it. A line that never
fails is a line nobody reads, so:

- **A cross-source disagreement above 20% now fails.** Genuine ones are allowed, but they must be
  written down in `acknowledgedDisagreements` with a reason. Most are not genuine: they are two
  models sharing a cell.
- **Two strings from one batch resolving to one cell now fails.** A source publishing two entries
  is that source saying they are two models. Exempt via `mergedInOneSource`, with a reason. This
  caught a bad alias within minutes of being written, and it catches the case the disagreement
  gate cannot — two models whose scores happen to agree.
- **A frozen source whose every difference is an addition** is now reported as a `versioning`
  declaration error rather than as rewritten history, which is what it actually is.

`npm run describe-change` says what a diff does to the published board — which model gained which
cells, which existing numbers moved. It goes at the top of every automated pull request and into
the WeChat notification, because "Qwen3.8 Max gained 12 cells: GPQA 92.6" is something a reader can
check and `batch-19-gdpval.jsonl | 175 +++` is not.

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

**Check for a data file before hiring a transcriber, and check the page's own JavaScript.** Batch
18 found ALE's endpoint at `/api/demo/leaderboard` — 689 rows where two hand-reads had produced 19
— and that path exists nowhere except the leaderboard's client chunk. `/api/leaderboard` and
`/data/leaderboard.json` are both 404, which is exactly how batch 03 concluded the board "publishes
nothing machine-readable". Grep the chunk for `fetch(` before believing a source is untranscribable.

Batch 05 recorded LiveBench as
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
integrity failure; `"live"` means it appends results and movement is new data; `"append-only"`
(LiveBench) means the version is frozen but the guest list is not — a cell that **appears** is new
data, a cell that **changed or vanished** is still an integrity failure. Getting that wrong either
turns the daily job permanently red or silently accepts a rewritten history.

Ask which one you are declaring by asking what the version freezes. LiveBench was `pinned` for two
months on the reasoning that a release freezes the question set — true, but a release does not
freeze *who has been run against it*. LiveBench added two models to release 2026-06-25 on
2026-08-04, seven weeks after publishing it, and the daily job stayed red until someone read the 46
cells and saw that every one of them said `appeared`.

## Adding a model

Model records are hand-authored because they also carry editorial content — inclusion,
display name, colour, tags, ordering — that has no source to generate from. Every *number*
on them is audited instead: `npm run check:models` fails when a catalog value contradicts
`data/sources/`, and reports how many values have no archive row at all. It audits 317 values —
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

**A missing AA measurement no longer blocks a record.** `intelligence` is `number | null`, so a
model AA has not measured yet is catalogued with `N/A` in the general-capability lens and ranks
normally on every lens that does not read it. This was a hard block until 2026-08-06: the field
was non-nullable, so Qwen3.8 Max sat outside the catalog with 36 fillable cells — LiveBench,
Epoch's GPQA run, DeepSWE, ALE, GDPval-AA — because one third party had not published a composite
of its own. Note that AA is several surfaces: its GDPval-AA board carried this model while its
parameter index did not, so "AA has not measured it" needs to name which AA you mean. Missing evidence is `N/A` here for the same reason it is everywhere else. The rest of the
table still holds: do not substitute another index, and do not estimate one.

Price then comes from the maker rather than AA, and the maker's own store is where a new model
appears first. Qwen3.8 Max was priced on the QwenCloud marketplace card three days before either
list-price table carried it (batch 21). **Read the card for a model you already carry before
trusting it**: that page prints promotional prices too, labelled `50% off` with both figures, and
the check is to confirm the unlabelled figure matches the list price already archived.

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
- **One published model string can mean two different models, and which one depends on the
  source.** DeepSeek shipped V4 Flash as a preview and then as the post-trained 0731 release,
  whose scores are far higher. LiveBench, Epoch and LMArena publish both and print `-0731` for the
  official one; Artificial Analysis never renamed its slug, so there the bare string *is* 0731.
  A single global alias therefore reported the preview's LiveBench numbers — 49.25 where the
  official model scores 100 — under the 0731 record, and nothing failed: `check:data` only
  *reports* a cross-source disagreement, and a mis-attribution inside one model looks identical to
  a benchmark being hard. Aliases may carry `"file"` to scope them to one batch; scoping is the
  last resort, and an unattributable string stays unmapped. Effort cannot substitute for it — on
  LiveBench both releases carry no effort at all.
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
| `scripts/capture-release-tables.mjs` | Renders a maker's release post over CDP and archives its tables — per release, not daily |
| `scripts/release-probe.mjs` | Watches every maker's release index for a post that was not there yesterday |
| `scripts/aa-new-models.mjs` | Asks whether AA has measured a model the catalog lacks — the one signal in AA worth acting on |
| `scripts/draft-model-record.mjs` | Drafts a catalog record from the archive, and names what it could not source |
| `data/release-pages.json` | Which index to watch per maker, how to read it, and the four that cannot be read |
| `scripts/notify-pushplus.mjs` | One WeChat push; silently skips itself without `PUSHPLUS_TOKEN` |
| `scripts/publish-integrity-issue.sh` | Opens/closes the `source-integrity` issue — the tier-C report's destination |
| `scripts/report-gaps.mjs` | What was never collected — floors, unaliased rows, new upstream models |
| `scripts/check-price-terms.mjs` | Fails when a promotional price reaches the catalog |
| `app/model-data.ts` | Model catalog, benchmark taxonomy, derived views |
| `app/observations.generated.ts` | Generated — never hand-edit |
| `app/models/page.tsx` | Rankings, coverage semantics, radar, bilingual UI |
| `app/page.tsx`, `app/home-content.ts`, `app/home.module.css` | The personal site at `/` — no data files, see above |
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
