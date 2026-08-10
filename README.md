# AI Model Observatory · AI 模型观测站

A bilingual, mobile-ready dashboard for comparing frontier AI models across versioned capability benchmarks, best-available agent systems, human-preference rankings, throughput, context windows, and token prices.

一个支持中英文切换与手机端使用的前沿 AI 模型看板，可查看排行榜、能力雷达图、多模型 Benchmark 折线对比、上下文窗口及实时 Token 价格。

**Live: [quarkspace.top/models](https://quarkspace.top/models)** — the root route of the same
deployment is the owner's personal site. Hosted on Tencent EdgeOne Pages, ICP-filed; see
[Deploy](#deploy-to-tencent-edgeone-pages).

For implementation details and AI-agent handoff, read [`AGENTS.md`](AGENTS.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The repository is maintained partly by a scheduled agent; its standing instructions are [`docs/AGENT-OPERATIONS.md`](docs/AGENT-OPERATIONS.md).

## Features

- 29 frontier and open-weight model families, each with its published operating points
- Chinese / English interface with persistent language preference
- separate rankings for general capability, agent systems, coding systems, human preference, speed, and value
- selectable model dossier and three-model comparison
- evidence-backed seven-axis capability radar with explicit `Not ingested` / partial / broad coverage states
- 72-benchmark catalog spanning reasoning, science, coding, agents, professional work, multimodality, and long context
- multi-model benchmark line charts and raw-score tables by capability family
- model-capability / best-system toggle to prevent harness results being presented as pure model ability
- OpenRouter price comparison rather than a live overwrite: the card shows the archived list
  price and prints the provider's current figure beside it only where the two disagree, because
  a number arriving at runtime has no archive row behind it
- portfolio ranks published only above a coverage floor, so a model measured on two of five agent
  benchmarks reads `N/A` instead of outranking one measured on all five
- mobile layout with a labelled bottom bar, card-form ranking rows, safe-area insets, and a
  layout probe (`npm run check:mobile`) that fails on horizontal overflow
- per-observation provenance: benchmark version, source type, harness, reasoning effort, tool setting, date, and context length
- sixteen sources re-read by script (`FETCHERS` in `scripts/fetchers/index.mjs`), which is what
  gives them a daily drift check and an automatic refresh; the rest are hand-transcribed, and
  every source card prints how long ago it was last read
- a release probe that watches all eleven makers the catalog carries, and a WeChat notification
  that fires on what is new rather than on what is merely still open
- 321 catalog values audited against the archive on every run, including the context window and
  open-weights flag; whatever is unsourced is listed rather than hidden

## Data sources

**A source counts as connected only when observation rows in `data/sources/` actually came from it** — the status is measured, not declared, so a source card can never imply coverage it does not have. Every source in the registry currently clears that bar; a source that did not would show as queued and affect nothing.

### Connected

- [Artificial Analysis](https://artificialanalysis.ai/leaderboards/models) — independent capability, speed, price, long-context and GDPval references
- [Vals AI](https://www.vals.ai/benchmarks) — independent finance, legal, medical and coding evaluations, all 37 boards, scripted
- [Epoch AI](https://epoch.ai/frontiermath) — FrontierMath Tiers 1-3 and Tier 4, plus an independent GPQA Diamond run
- [ARC Prize](https://arcprize.org/leaderboard) — verified ARC-AGI-1, 2 and 3 results across reasoning efforts
- [Artificial Analysis](https://artificialanalysis.ai/methodology/intelligence-benchmarking) — its own runs of GPQA Diamond, HLE, SciCode, AA-LCR, Terminal-Bench 2.1, τ³-Banking and IFBench
- [Terminal-Bench](https://www.tbench.ai/leaderboard/terminal-bench/2.1) — 2.1 and 2.0, one row per harness
- [DeepSWE v1.1](https://deepswe.datacurve.ai/) — benchmark-native long-horizon coding results
- [Scale Labs](https://labs.scale.com/leaderboard) — MCP-Atlas and SWE-Bench Pro
- [OSWorld 2.0](https://osworld-v2.xlang.ai/) · [Agents' Last Exam](https://agents-last-exam.org/leaderboard) · [FrontierSWE](https://www.frontierswe.com/) · [Toolathlon-Verified](https://github.com/hkust-nlp/Toolathlon)
- [Mercor APEX-Agents](https://www.mercor.com/apex/apex-agents-leaderboard/) · [MMMU](https://mmmu-benchmark.github.io/)
- [LiveBench](https://livebench.ai/) — 23 objective, contamination-limited tasks, fetched from the site's own data files rather than transcribed
- [SWE-bench](https://www.swebench.com/) — one row: the official board is almost entirely pre-2026 models, and Gemini 3 Flash is the only one this catalog tracks
- [LM Arena](https://arena.ai/leaderboard/text) — human preference, kept separate from capability and used only for Elo
- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties) — live provider pricing
- Vendor material: [Google DeepMind](https://deepmind.google/models/gemini/flash/) · [DeepSeek V4](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro) · [Qwen3.7](https://qwen.ai/blog?id=qwen3.7) · [Kimi K3](https://github.com/MoonshotAI/Kimi-K3) (comparison seed only, not the global standard)

### Measured and not connected

- **Stanford HELM** — evaluated on 2026-08-01 and its source card *removed* rather than left queued. HELM is fully machine-readable, but across all 18 of its projects exactly one model overlaps this catalog, and its frontier project stops about a generation short. A card would have promised an ingestion target that does not exist. The measurement is recorded in `docs/ARCHITECTURE.md` §9 — re-run it before re-adding HELM.

Benchmark observations are stored in `app/model-data.ts` as `model × benchmark × version × harness` records. The ingestion order is benchmark-native leaderboards first, vendor release material for gaps, and independent evaluations for cross-checking. A missing observation is displayed as `Not ingested`, never as a score of zero. Provider pricing is *compared*, not refreshed: `app/api/live-models/route.ts` looks up exact provider ids and the UI shows the archived list price with the provider's current figure beside it where the two disagree. A number arriving at runtime has no archive row behind it, so it never becomes a catalog number.

A cell may hold more than one observation. Terminal-Bench 2.1 reports Fable 5 at 83.8% under Claude Code and 80.4% under Terminus 2; both rows are kept, the table shows the primary and marks the alternates as `+n`. Listing a source is not coverage — only transcribed rows are. `npm run check:data` prints filled cells and the benchmark / independent / vendor split so the difference stays visible:

```text
2133 observations across 1382/2088 cells (66.2% cell coverage;
benchmark 918 / independent 1025 / vendor 190)
```

The percentage moves in both directions on purpose: adding a benchmark widens the grid, so
a batch that adds evidence *and* twelve new benchmark columns can lower the ratio while
raising every absolute count. Read the three numbers together, not the percentage alone.

Data is not hand-written. Raw leaderboard rows are archived verbatim in `data/sources/*.jsonl`,
every mapping decision lives in `data/model-aliases.json` with a written reason, and
`npm run ingest` generates the typed rows. A row whose model string has no alias is skipped
and reported rather than guessed into place. `docs/INGEST-PROMPT.md` holds the transcription
contract used to collect new rows — but check for a published data file first: LiveBench renders
client-side and looked untranscribable until it turned out the page fetches its own CSV, and
DeepSWE's board loads a JSON artifact carrying every configuration it has ever run. Epoch AI
publishes its whole benchmark hub as one CC BY ZIP that the page never mentions, and Terminal-Bench
answers an unauthenticated function call found in its client's source. Agents' Last Exam was
recorded as publishing nothing machine-readable through two hand-reads; its leaderboard calls
`/api/demo/leaderboard`, a path that appears only inside the page's own JavaScript bundle. And
GDPval-AA sits behind Artificial Analysis' Pro tier in the API while the leaderboard page is
public — so that one is read by rendering the page, and MMMU the same way. Every one of them is
scripted (`npm run fetch:sources`), which is what gives them an automatic drift check and an
automatic daily refresh. The remaining batches have neither.

Sometimes there is no data file at all and the page *is* one. Vals AI was recorded as publishing
nothing machine-readable through two passes; its boards are Astro, which server-renders each
component's props into a `props="…"` attribute, so the whole leaderboard sits in the HTML as
escaped JSON. A search for `<table>`, `fetch(` or an `/api/` path answers no on a page that
contains every row. The other half of that miss: `/benchmarks` is an index with no scores on it,
and that is the page both passes measured.

Finding a data file is not the end of it either: **the file has to be the one the page renders.** Epoch's
ZIP does publish FrontierMath, and reading it would have put a retired question set — the
2025-02-28 problems, about 1.7x lower for the same model — into a column of current scores. The
board the site actually draws comes from `/data/benchmarks.csv`, which only its client chunk names.
Same publisher, same benchmark, two versions, and nothing about the filename says which is which.

Model records are hand-authored, but their numbers are audited the same way. `npm run check:models`
fails when a catalog value contradicts the archive and reports how much of the catalog nothing
on file supports:

```text
Model provenance passed: 321/321 catalog values backed by data/sources (100%),
0 with no archive row.
```

Three checks fail on things that used to be printed and ignored: a cross-source disagreement
above 20% about one configuration, two published strings from one batch resolving into one cell,
and a frozen source whose every difference is an addition. Each has an escape hatch that costs a
written reason. The first two exist because a preview release once published its scores under the
name of the model that replaced it, in plain view of a report nobody read.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run check:data
npm run dev:next
```

Open `http://localhost:3000`.

The full check set, which CI also runs:

```bash
npm run lint
npm run ingest && git diff --exit-code app/observations.generated.ts
npm run check:data      # observation contract + coverage report
npm run check:models    # every catalog number vs the source archive
npm run check:prices    # a promotional price that reached the catalog
npm run build
```

`npm run check:upstream` is separate: it re-reads every scripted source over the network and
diffs it cell by cell, so it runs daily rather than per commit. It fails only when a **pinned**
source moved under a frozen version; a **live** board moving is new data, and the daily job
rewrites that batch and merges it. `npm run fetch:sources` re-collects them all, `npm run
fetch:sources <id>` just one.

`npm run report:gaps` asks the opposite question — what exists that was never collected. It never
fails; the scheduled job turns its output into one self-updating issue. `AA_API_KEY` in the
environment enables the Artificial Analysis source; without it that source skips itself and
everything else still runs.

`npm run check:mobile` is also outside CI, because it drives headless Chrome against a running
build. Start one first, then probe 320 / 390 / 430px:

```bash
npm run build && PORT=3111 npm run start:next
npm run check:mobile
```

It fails on horizontal document overflow and warns on text under 9px or controls under 36px.
Layout rules and the rest of the interface contract live in [`docs/UI.md`](docs/UI.md).

Production validation (the same command EdgeOne Pages runs):

```bash
npm run build
npm run start:next
```

`npm run build` is the canonical production build for EdgeOne Pages. The old Vinext compatibility build remains available as `npm run build:sites`, but is not part of the normal deploy path.

## Deploy to Tencent EdgeOne Pages

GitHub `main` is the single source of truth. EdgeOne Pages watches the branch and deploys the Next.js application and API route directly; a second Sites deployment is not required.

EdgeOne builds from the branch **independently of GitHub Actions**, so a red CI run does not hold
back a deploy. Only `npm run build` can stop production. That means a merge to `main` publishes
whether or not the checks passed — read the CI result before merging, not after.

1. Push this repository to GitHub or Gitee.
2. In EdgeOne Makers, choose **Import Git repository**.
3. Select this repository and use Node.js 22.
4. Set the install command to `npm ci`.
5. Set the build command to `npm run build`.
6. Keep the framework preset as Next.js / automatic detection.
7. Deploy, then optionally bind a custom domain.

### The custom domain and the ICP filing

This deployment serves `quarkspace.top` and `www.quarkspace.top`; EdgeOne's own
`ai-model-observatory-lhi0hg2y.edgeone.cool` serves the same build and is the fallback to test
against when the custom domain's DNS is the thing that broke. `data/deployment.json` names the
apex, which is what activates `npm run check:deployment`.

Binding is three steps and the order matters: EdgeOne first proves ownership through a `TXT`
record at `edgeonereclaim.<domain>`, and only then issues the per-host CNAME targets that route
traffic. **Ownership verification serves no traffic** — a domain can pass it and still not resolve
at all, which is a confusing hour if you expect otherwise.

For a mainland-China acceleration region the domain must be ICP-filed, and the filing has to be
displayed: `app/site-beian.tsx` renders the **service** filing number (the `…号-1` suffix, not the
bare entity number) from the root layout, so it appears on every route. Tencent also requires the
filed apex **and** its `www` host to both serve. Full detail, including the two filing authorities,
is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §6 — read it before changing that component.
Without an ICP-filed domain, start with the platform preview domain or an overseas/global region.

## Project structure

```text
app/
  api/live-models/route.ts     # OpenRouter lookup, by exact provider id
  layout.tsx                   # root layout: fonts, viewport, and the ICP strip on every route
  site-beian.tsx               # ICP filing footer — one place, all routes (+ .module.css)
  globals.css                  # the observatory's visual system and phone contract
  model-data.ts                # catalog, benchmark taxonomy, derived views, coverage floor
  observations.generated.ts    # generated by npm run ingest — never hand-edited
  models/page.tsx              # THE OBSERVATORY: ranking, radar, comparison, pricing UI
  models/layout.tsx            # its title (the page is a client component)
  page.tsx                     # the owner's personal site at / — no data files
  home-content.ts              # that site's copy (source of truth: ../quark-space)
  home.module.css              # that site's styles, scoped under .home, --h-* properties
data/
  sources/*.jsonl              # append-only archive: one row per published result
  model-aliases.json           # every editorial decision, each with a written reason
  deployment.json              # where production is, so something can verify it
scripts/
  fetchers/*.mjs               # one module per source that can be re-read by script
  fetch-source.mjs             # runs them; --check diffs, --live refreshes the moving boards
  ingest.mjs                   # archive + aliases -> observations.generated.ts
  check-model-data.mjs         # observation contract
  check-model-provenance.mjs   # every catalog number against the archive
  report-gaps.mjs              # what has NOT been collected
  check-mobile.mjs             # layout probe under device emulation
  check-deployment.mjs         # does production serve what main says
.github/workflows/
  ci.yml                       # the contract, on every push and pull request
  upstream.yml                 # daily: drift, refresh, collection gaps
docs/ARCHITECTURE.md           # diagrams, data contract, domain/filing, collection state
docs/UI.md                     # type scale, breakpoints, phone contract, verification
docs/AGENT-OPERATIONS.md       # standing instructions for the scheduled agent
AGENTS.md                      # concise coding-agent handoff rules
CHECKPOINT.md                  # where things stand — read this first
TODO.md                        # what is next (finished items are deleted, not ticked)
LOG.md                         # append-only history: what happened and why
GOTCHAS.md                     # the durable traps, stably numbered — scan before starting
```

## What maintains itself

A daily job asks three questions and gives each a different answer, because collapsing them is
how a red check becomes background noise.

| Finding | Verdict |
| --- | --- |
| A number moved under a version that is supposed to be frozen | Integrity failure. The job goes red and a human decides. |
| A live board published new results | New data. The batch is rewritten, the contract runs, and it merges itself. |
| Something exists that was never collected | A collection target. It becomes one self-updating issue — and only the part somebody can act on today is counted. |

An upstream model the catalog does not carry is the clearest case of that third answer being a
*target* rather than a defect: it is counted only when it clears the coverage floor, because under
the floor nobody can add it until a source evaluates it further. The rest — models under the floor,
models with no evidence yet, and pricing tiers that must never get a record at all — are printed
inside a collapsed section that says so.

The refresh is idempotent, so a week in which nothing moved writes nothing and merges nothing.
What may merge unattended is bounded by the file set rather than by who pushed it: a change
confined to `data/sources/` and the generated store is numbers moving inside a mapping that was
reviewed when its fetcher was written, and the contract is a complete check on it. A change
reaching `app/model-data.ts` or `data/model-aliases.json` introduces a *new* mapping, which is
where every real mistake in this project has come from, and it opens a pull request instead.

## Notes

- Metrics from different sources are not blended into a hidden universal score.
- Arena remains a separate human-preference signal rather than a capability axis.
- Raw benchmark values, versions, evaluation object, and scoring method remain visible.
- Missing source values remain `N/A`; zero is reserved for a real published score of zero. The radar never zero-fills or estimates a missing axis.
- Coverage is evidence completeness, not model quality: `Not ingested` means no compatible public observation has been loaded yet.
- Agentic results can depend on the model snapshot, harness, tools, reasoning effort, budget, and number of attempts.
- Upstream leaderboards and provider pricing change over time, so dated snapshots should be refreshed deliberately.

## License

No open-source license has been selected yet. All rights reserved unless a license is added by the repository owner.
