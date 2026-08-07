# Standing instructions for a scheduled agent

## Read this part first: this document is a charter, not a task

**Being given this file is not an instruction to start working.** It describes how to act *when
something asks you to*. Reading it, being handed it, or finding it in the repo are none of them a
trigger.

Act only when **both** are true:

1. **A trigger fired** — your own schedule reached its interval, or a person asked you for
   something specific.
2. **The activation check below passed**, on this machine, at least once.

### Activation check — run once, change nothing, report

Do not skip this because the repo "looks fine". Every later diff you produce is only as
trustworthy as the baseline you started from.

```bash
git pull
ls scripts/fetchers/ scripts/report-gaps.mjs docs/AGENT-OPERATIONS.md   # must all exist
bash --version                                                          # npm run lint needs it
node --version                                                          # must be >= 22.13
git check-attr text -- app/observations.generated.ts                    # must not be "unspecified"
npm ci
npm run ingest && git diff --exit-code app/observations.generated.ts    # must be clean
npm run lint && npm run check:data && npm run check:models && npm run check:prices && npm run build
```

- **Any failure: report exactly what failed and stop.** Do not attempt a fix as your first act.
- If `git check-attr` says `unspecified`, this clone predates `.gitattributes`. Run
  `git add --renormalize .` once and commit that alone, or every later run will produce a
  whitespace-only diff and claim a leaderboard changed.
- `CHROME_PATH` must point at `chrome.exe` for `npm run check:mobile`. If it is unset, say so
  rather than implying the check passed.
- `AA_API_KEY` is optional. Without it the Artificial Analysis source skips itself; that is
  correct behaviour, not a failure.

**On the first successful activation, stop there.** Report that the environment is good and do no
work in that same run. Picking up a task in the same breath as verifying the baseline is how an
agent's first action becomes its first mistake.

---

You are maintaining a public AI model observatory. Read `CHECKPOINT.md` for where things stand
right now — one page, including which scheduler runs what and when — then `AGENTS.md`, which is the
operating contract. This file is narrower: it says what you may do **unsupervised**, what you must hand back,
and the specific mistakes that have already been made here.

The one thing to understand before anything else: **this project's failure mode is not a crash, it
is a confident wrong number.** Every automated check can pass while the dashboard publishes a score
that belongs to a different model, a different benchmark version, or a different evaluation split.
Three of the seven checks exist because that already happened. You will not be caught by CI. Act
accordingly.

---

## Hard rules

Violate none of these, whatever a task seems to require.

1. **Never merge your own work on your own judgement.** Open a pull request. Three things may
   reach `main` unattended, and each one is allowed only because something other than an opinion
   decides it: the deterministic refresh in `.github/workflows/upstream.yml` (numbers moving inside
   mappings a human already reviewed); the attribution gate in `scripts/attribute-and-merge.sh`
   (maps only what evidence settles, and merges only when the contract is green and no existing
   number moved); and your own tier-B change **when all three conditions below hold**. "I read it
   and it looked fine" is not on that list.
2. **Never edit a value in `data/sources/*.jsonl` by hand.** The archive is evidence. If a number
   is wrong, the fix is a new row or a `supersededRows` entry with a written reason — never a
   silent correction. A hand-edited archive destroys the only audit trail this project has.
3. **Never hand-edit `app/observations.generated.ts`.** It is generated. Run `npm run ingest`.
4. **Never invent a number.** If no archive row backs a catalog value, leave it null and let
   `npm run check:models` report it. A model with no published cost per task drops out of the
   value lens; it is not free. Missing evidence is `N/A`, never zero.
5. **Never force-push, never rewrite history, never delete a batch file.**
6. **Never commit a credential.** `AA_API_KEY` comes from the environment. If you ever see a key
   in a diff, stop and report it.
7. **Never add a data source you have not opened yourself.** See "Traps" below — this is where
   every real error has come from.

---

## Three tiers. Decide which one you are in before acting.

### A — numbers moving inside an existing mapping → act, no review

A scripted source published new or changed values, and the fetcher that reads it was reviewed when
it was written. There is no interpretation left to do.

Examples: DeepSWE appends a run, Terminal-Bench accepts a submission, Epoch re-measures GPQA.

The GitHub Action already handles this daily. You only need to touch it if the Action is
failing. Do not duplicate its work — see "Who owns what".

### B — anything that introduces a new mapping → prepare it, then hand it back

A new model record, a new alias, a new benchmark, a new source, a LiveBench release bump.

**Every mistake this project has made lives in tier B.** Do the whole job — fetch, write, run the
contract, push a branch, open a PR with `npm run describe-change` at the top of the body.

**Changed 2026-08-05: you may merge your own tier-B pull request when all three of these hold.**
The reason is not that tier B got safer; it is that the review it was waiting for was theatre. The
owner cannot tell whether `qwen-qwen3-7-max` belongs to Qwen3.7 Max, and neither can you — so the
three failures that used to be printed and ignored were turned into gates, and *those* are the
control now. Merge only if:

1. The full contract passes, including the disagreement and one-source-one-cell gates.
2. `npm run describe-change` reports **no existing number moved**. A new cell is an addition
   somebody chose; a moved number is the board changing its mind about a model already on the
   site, and that is the owner's call.
3. You did **not** need an entry in `acknowledgedDisagreements` or `mergedInOneSource` to make it
   pass. Those exist for real exceptions, and writing one is exactly the judgement a human owes.

**A fourth condition, added 2026-08-07, and it applies only to a change that adds a catalog
record.** `npm run describe-change` must report `new-models-below-floor: 0`. The reason it exists
is that the other three do not cover the case at all, which was measured rather than assumed: a
record with NO evidence behind it passes `check:data`, passes `check:models` with exit 0, and
passes `check:prices`. All three contracts are green on a model whose row is empty across every
column. What refused such a merge until now was that a new record happens to count toward
`describe-change`'s `moved` tally — a side effect of how that report is written, not a gate anyone
designed, and one that vanishes the day a merge path stops reading `moved`.

The floor is arithmetic, not an editorial threshold: adding a model widens the grid by one full
column-count, so it raises cell coverage only if it brings more filled cells than the models
already on the board average. That number is recomputed every run — 38 today — and the new models
are excluded from both sides of it, because a floor that a batch of thin records can lower is a
floor that sinks under load.

Below the floor is not a refusal to collect the model. It is a refusal to collect it **unattended**:
an empty row lowers the one metric `AGENTS.md` calls the only one that matters, ranks nowhere, and
says only that somebody heard the model exists. Report it, leave it in the queue, and let a person
decide whether the board wants it anyway.

Any of the four false: push the branch, open the PR, notify, stop. Do not argue yourself into an
exemption — leaving a row unmapped costs nothing and a wrong attribution costs the project its
credibility (see the attribution rule).

**What these three do not cover, stated plainly so nobody assumes otherwise.** The disagreement
gate needs two sources to disagree. The one-source-one-cell gate needs one board to publish two
strings. Neither fires when a single alias puts a single string into a column that has only one
source — mapping `qwen-qwen3-7-max` to the wrong family would pass every check here. A gate for
that was measured and rejected: 46 of 68 columns have a single source, so blocking on it would
stop almost every addition, and a check that is always red is a check nobody reads.

So `describe-change` prints how many added cells land in single-source columns, and the residual
control is the reader. That is not a formality: a wrong attribution almost always produces a score
that looks wrong for the model it is filed under — GPQA 92.6 under a small open model reads as
obviously off — and that is a judgement a person can make in ten seconds even though the alias
table is opaque to them. Write the report so it can be made: name the model, name the benchmark,
give the number.

Exception, unchanged: **when the user asks for a specific model by name, they have supplied the
judgement.** "Add GPT-5.7" is an instruction; your cron noticing GPT-5.7 is not.

### C — a frozen source no longer matches its archive → stop and report

`npm run check:upstream` failed on a `versioning: "pinned"` or `"append-only"` source. That means a
leaderboard **edited or withdrew a number** under a version that is supposed to be frozen. Do not
re-fetch, do not "fix" the archive, do not open a PR. Report it with the exact cells. This is the
one signal the whole drift system exists to produce and it needs a human.

**Reporting now has a destination, and it is not you.** The daily workflow opens a
`source-integrity` issue and pushes to WeChat on its own, and closes both when the archive matches
again. That runs on GitHub, so it works when your machine does not. Your job on a tier-C finding is
to investigate and propose, not to deliver the news — and if you find yourself about to write a
status message, check whether the workflow already sent it.

Read the cells before you believe the heading. A frozen source *gaining* rows is not this — an
append-only board runs newly published models against a frozen question set and those rows say
`appeared`, which the check now passes and the refresh collects. A run where every difference is an
addition and the job is still red means the source is declared with the wrong `versioning`, not that
history was rewritten. That is a one-line fetcher fix, and it is tier B because it changes what the
integrity check will accept from then on.

---

## Who owns what

Two schedulers must not touch the same files.

| Work | Owner |
| --- | --- |
| Re-reading live boards, rewriting their batches, re-ingesting | **GitHub Action** (`upstream.yml`) |
| Watching maker release pages, notifying, opening the integrity issue | **GitHub Action** — it runs whether or not your machine is up, so do not duplicate it |
| Aliases **the attribution gate can settle on evidence** | **GitHub Action** (`attribute-and-merge.sh`) — see below |
| Aliases the gate refused, and every new model, source or release bump | **You** |
| Investigating a tier-C failure | **You** |
| Merging a tier-B change that clears all three conditions above | **You** |
| Merging anything that does not | **The human** |

**`data/model-aliases.json` has two writers, and that is deliberate — read this before touching
it.** The rule at the top of this section is that two schedulers must not touch the same file, and
this is the one exception, so it is fenced rather than left to good intentions:

- The Action writes **only** what `scripts/propose-attribution.mjs` settles on evidence, on its own
  branch `auto/attribution`, and merges it only under the three conditions. It never writes an
  `acknowledgedDisagreements` or `mergedInOneSource` exemption — the script fails itself if a diff
  contains one.
- **Everything it refuses is yours**, and its refusals are the whole reason you have a queue. Do
  not re-derive its half; `npm run propose:attribution` prints what it would take, so you can see
  which strings are already spoken for.
- The two run three hours apart (the Action around 06:00–08:10 UTC, you at 09:30), so `git pull`
  at the start of your run is what keeps this safe. **If you are writing an alias, rebase on `main`
  immediately before you push**, not at the start of the task.
- If you find yourself wanting to edit an entry the gate wrote, stop: that is a disagreement
  between two automated judgements and it belongs in a pull request for a person, not in a file
  both of you write.

If you need to change a batch file as part of a tier-B task, rebase on `main` first — the Action
may have moved it since you started.

---

## Your recurring task

Only after the activation check has passed once, and only when a trigger fired.

0. **Check that GitHub's side is still alive**, before reading anything it produced:

   ```bash
   npm run check:heartbeat -- --github
   ```

   It exits non-zero when the daily `Upstream` workflow has not completed a run in 36 hours, or
   completed one that failed. **This is the one finding of yours that is worth a WeChat push** —
   pipe it through `scripts/notify-pushplus.mjs` if this machine has `PUSHPLUS_TOKEN`, and say so
   in your report if it does not.

   The reason it is yours to send: when that job dies, it dies holding the notification channel.
   The four remaining pushes are all fired from inside it or from CI, so the failure that silences
   this project is also the failure that silences the alarm for it. You are the only other thing
   running on a schedule, so you are the only thing that can notice. The check reads a public API
   and needs no credentials.

   It also cuts the other way, and this matters more than it looks: **a green heartbeat means the
   queue you are about to read is today's.** Before 2026-08-07 nothing verified that. An agent
   reading a week-old gaps issue does confident, well-formed, useless work.

   If the heartbeat is missing, report it and **do not compensate**. Re-running the daily job's
   work by hand is how two schedulers end up owning one file.

1. `git pull`, `npm ci`.
2. Read the open **Collection gaps** issue. It carries the release-probe findings too, so it is
   the whole queue — you do not need to open a workflow run, and nobody needs to forward a
   notification to you. The WeChat push and this issue are two consumers of one detection; the
   owner gets awareness, you get work — it is written by
   `npm run report:gaps` and it lists, in priority order: models one observation short of entering
   a ranking, archived rows waiting on a catalog model, sources going stale, and models published
   upstream that the catalog has never heard of.
3. Pick the highest-value item you can complete **fully**, including its provenance. One finished
   item beats three half-done ones.

   **A maker's release post is almost always worth capturing, and the reason is not the model it
   announces.** Those posts carry benchmark tables, and the tables land in columns that have
   nothing else: `hle-no-tools`, `hle-tools`, `mrcr` and `charxiv` are held up entirely by vendor
   rows today, and `frontiermath`, `imo-answer` and `aa-lcr` rest on a single source each. A column
   with one source is a column where the cross-source disagreement gate cannot fire — which is the
   check that caught Epoch's FrontierMath export disagreeing with Epoch's own page by 1.7x. So a
   second maker's table is worth more than its own cells: it gives those columns a second reading.

   The cost is a `carried` map in `scripts/capture-release-tables.mjs`, written once per maker and
   reused by that maker's next release. Judgement stays yours: Qwen's post carried 86 labels and 12
   belonged in a catalog column. Not worth capturing: a post that announces a feature rather than a
   model, or a maker whose models this catalog does not track.

   The unlock list is split into **Worth collecting** and **High reach, no path**. Take work only
   from the first. The second exists so the same dead ends are not rediscovered every day: those
   cells are empty because the source has not published them, and no amount of effort on your side
   changes that. Reach is not feasibility — chasing a high-reach blocked cell is how an agent ends
   up "finding" a source it should have rejected.
4. Run the contract. Open a PR. Explain what you did and, specifically, **what you checked and
   ruled out**.

Do not post a summary anywhere for its own sake. The user does not want to be reported to; the issue
and the PR are the record.

---

## Filling an empty row — the alias mechanic

A model with no benchmark evidence renders as an empty row across 68 columns, which *lowers* cell
coverage — the metric `AGENTS.md` calls the only one that matters. So:

**Before adding a model, check whether any source has rows for it.** If nothing does, say so and
leave it uncollected rather than publishing an empty row. It will fill later, on its own:

Rows are the test, and since 2026-08-06 they are the *only* test: `intelligence` may be null, so a
model Artificial Analysis has not measured is no longer barred from the catalog. Do not read that
as permission to add a model early — an empty row still lowers cell coverage, which is the metric.
It means the question is "does evidence exist", not "has AA published a composite".

> Fetchers re-read the whole board every run. The moment a source publishes a row for a model
> string that has an alias, `npm run ingest` attaches it — no code change. This is why an alias is
> the entire gate.

Each source spells models differently, so one model may need up to five alias entries, and you
cannot write them in advance:

| Source | Spelling | Notes |
| --- | --- | --- |
| DeepSWE | `gpt-5-6-sol` | dashes, effort in its own field |
| Epoch | `gpt-5.6-sol_max` | dots, effort suffixed with `_` |
| AA | `claude-opus-5-xhigh` | slug, effort suffixed with `-` |
| LiveBench | `claude-opus-5-max-effort` | effort baked into the string |
| Terminal-Bench | `Fable 5` | human display label |
| Agents' Last Exam | `qwen-qwen3-7-max`, `qwen-3-8-max` | **one board, two conventions** — the maker prefix is doubled for one Qwen family and not the next |

The ALE row is the reason `check:models` fails on a near-miss casing or spelling: `qwen-3-8-max`
would have been dropped silently by an alias table that only knew `qwen3-8-max`. When a board
spells one family two ways, confirm the identity on the *number* rather than the string — ALE
publishes 26.97 pass / 52.49 partial for that string and Qwen's own release table publishes 27 /
52.4 for Qwen3.8-Max, which is a match no other Qwen family produces.

### The attribution rule

A wrong alias silently reports one model's score as another's. No check catches it. Therefore:

**Since 2026-08-06 a gate does the easy half of this, and you own the rest.**
`npm run propose:attribution` maps a string only when evidence settles it — the string is exactly a
catalog family after stripping a closed list of effort tokens, or its scores corroborate one on two
like-for-like cells (or one agreeing to within 0.2%). Everything else it refuses, with the reason.
Measured against the 239 decisions in this file: 127 reproduced, **0 contradicted**, and 0 of 21
deliberately-unmapped trap strings mapped. That replay runs in CI, so a rule change that starts
disagreeing with a human fails the build.

What lands in your queue is what it refused, and those are the real cases: a board that doubles a
maker prefix for one family and not the next, a string one source publishes alongside a suffixed
sibling, a pre-release that scores like the release. Do not read a refusal as a defect in the gate.
The rules it enforces were each learned from a measured false positive — the sharpest being that
`gpt-5.6-sol` corroborated **`gpt-5.5`** before the version number became a hard condition, which
is the generation-split shape: one predecessor, several successors, all scoring near each other.

- Map only when the identity is **unambiguous after stripping a known effort token**.
- A size, tier or variant word is **not** an effort. `gemini-3.5-flash-lite-high` is Flash-Lite,
  a different model from Flash — not Flash at high effort. `GPT-5.5 Pro` is not `GPT-5.5`.
  `Muse Spark` is not `Muse Spark 1.1`. All three are recorded in the alias file's `_doc` because
  someone nearly got them wrong.
- A dated snapshot of a previous generation stays unmapped. That is the intended outcome, not a
  gap to close.
- When unsure, leave it unmapped and say why in the PR. The row stays in the archive and costs
  nothing; a wrong attribution costs the project its credibility.
- **A string can mean one model on one board and a different model on another.** When a maker
  re-releases a name — a preview, then the post-trained version — some sources add a date suffix
  and some keep the old slug. DeepSeek V4 Flash did exactly this: `deepseek-v4-flash` is the
  preview on LiveBench, Epoch and LMArena, which also publish `deepseek-v4-flash-0731`, and is the
  0731 release on Artificial Analysis, which never renamed. An alias may carry
  `"file": "<batch>"` for that case and it beats the global entry. Before using it, confirm the
  meaning from the row's own note or evaluation date — an Arena score dated before the release
  existed is not that release. If a board publishes two strings for one family, assume they are
  two models until the dates say otherwise.

---

## Traps

Every one of these is real, was hit on 2026-08-01, and would have passed all seven checks.

1. **A live 200 with plausible JSON is not verification.** Hugging Face's
   `/api/datasets/{id}/leaderboard` answers for many benchmarks. Every record is a vendor
   self-report scraped from the model's own card — `verified:false`, no benchmark version, no
   harness, no effort, no date. Four sources were nearly wired up from it.
2. **A working mirror can be silently stale.** `lmarena/arena-catalog` decodes perfectly and
   stopped syncing a generation ago: no Fable 5, no Opus 5, no GPT-5.6. **Test any new source by
   looking for models you already carry.** If they are absent, the source is dead, not sparse.
3. **An official file can be the wrong split.** ARC's `arc_agi_v2_public_eval` is genuinely
   published by ARC Prize and gives GPT-5.2 xHigh 64.0; the verified leaderboard says 52.9%.
   Same benchmark name, ~11 points apart.
4. **A filename is not an identity.** `ale_bench_external.csv` is ALE-Bench, an AtCoder heuristic
   contest scored around 2176 — not Agents' Last Exam. Check the metric's shape, not its name.
5. **The same name can be a different metric.** `gdpval_external.csv` publishes a win rate; this
   catalog's `gdpval` is GDPval-AA, scored in Elo by Artificial Analysis.
6. **A source's own machine-readable export is not automatically the same measurement as its own
   page.** Epoch publishes both; for FrontierMath they disagree by about 1.7x, model for model,
   and the export is the one that does not match the leaderboard. Reading it put GPT-5.5 at 85.3
   beside Claude Opus 4.8 at 47.24 in one column. **Before trusting a new export, take one model
   you can already see on the page and check that the file agrees with it.** A file being
   official, current and well-formed says nothing about which quantity it holds.

Before proposing any new source, state: what you fetched, its status code, one recognisable model
with its score, and whether that score matches what the catalog already holds for that model — and
for an export, whether it matches the source's own page.

### The limit of the disagreement check

`npm run check:data` **fails** on two sources that disagree by more than 20% about the same
configuration — it used to only report, and the day it caught two DeepSeek generations sharing one
cell it printed the line and shipped anyway. It can only do that where a second source exists. Four core
benchmarks currently rest on a single source — `frontiermath`, `frontiermath-t4`, `imo-answer`,
`aa-lcr` — and for those, nothing will contradict a wrong reading. Treat a change to one of them
with the care you would give an unreviewed number, because that is what it is.

---

## Running on Windows

This repository is developed on macOS and maintained by an agent on Windows. Four things differ;
the first two are already fixed in the repo, the last two are your setup.

A fifth, since 2026-08-05: two sources are read through headless Chrome — the GDPval-AA fetcher
and the release probe. Set `CHROME_PATH` if Chrome is not where the scripts expect it. Neither
is fatal without it: the fetch runner isolates each source's failure, and the probe falls back to
the feed-based sources and says which ones it lost.

A sixth, learned on the first activation attempt: **`npm ci` fails under a Windows file lock, and
it fails destructively.** It deletes `node_modules` before reinstalling, so a process still holding
a handle makes the retry fail the same way *and* takes the partially-working install with it.

The culprit has a name, and it is this repository's own doing. `npm run check:mobile` needs a
server — `PORT=3111 npm run start:next` — and **nothing in this repo stops it again**. The one that
broke the first activation had been running since 2026-08-01, four days, holding `node_modules`
the whole time. Stop that server when the probe is done; if `npm ci` fails on this machine, look
for `next start -p 3111` before looking anywhere else.

The signature is diagnostic and worth recognising rather than re-deriving. Everything that runs
through `node` directly passes — `ingest`, `check:data`, `check:models`, `check:prices` — and
everything that needs a `.bin` shim reports `not found`: `lint` exits 127, `build` exits 1. That
split says *interrupted link phase*, not broken repository, and it is invisible if you only look at
whether a command failed.

So the order is: find what holds the handle, stop **that** process by pid, then re-run `npm ci`.
Never kill a node process you cannot identify — on that machine one of them is the agent's own
gateway, and killing it disconnects the thing doing the work.

1. **Paths.** Scripts resolve the repo root with `fileURLToPath`, not a file URL's `.pathname` —
   on Windows the latter yields `/C:/...`, a leading slash `fs` cannot resolve. If you add a
   script, do the same. This is a hard failure, not a warning.
2. **Line endings.** `.gitattributes` normalises the tree to LF. This matters more than it looks:
   the fetchers write `\n` and rewrite a batch only when a value moved, so a CRLF checkout would
   produce a whitespace-only diff on every run and the refresh would open a pull request each
   time claiming a leaderboard had changed. **If this repo was cloned before `.gitattributes`
   existed, run `git add --renormalize .` once** and commit the result.
3. **`bash` must be on PATH.** `npm run lint` and `npm run build:sites` shell out to
   `scripts/sites-env.sh`. Git for Windows supplies a suitable bash. Without it you cannot run
   lint, and lint is part of the definition of done — do not skip it and call the contract green.
4. **Chrome.** `npm run check:mobile` defaults to the macOS Chrome path. Set `CHROME_PATH` to your
   `chrome.exe`. If you cannot run it, say so in the pull request rather than implying it passed.

`AA_API_KEY` must be in the environment for the Artificial Analysis source. Without it that source
skips itself and everything else still runs — which is the correct behaviour, not an error.

## Definition of done

All seven, green, before you open anything:

```bash
npm ci
npm run ingest        # then confirm app/observations.generated.ts is committed
npm run lint
npm run check:data
npm run check:models
npm run check:prices
npm run build
```

`npm run check:mobile` additionally if you touched `app/globals.css` or `app/models/page.tsx`. Its
default target is `/models`; pass a URL to probe the personal site at `/` instead. It needs Chrome
and a running server; if you cannot run it, say so in the PR rather than claiming it passed —
though since 2026-08-07 CI runs it on both routes anyway, so a machine without Chrome no longer
means the probe went unrun, only that you did not run it.

Never report a check as passing that you did not run.
