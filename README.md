# AI Model Observatory · AI 模型观测站

A bilingual, mobile-ready dashboard for comparing frontier AI models across versioned capability benchmarks, best-available agent systems, human-preference rankings, throughput, context windows, and token prices.

一个支持中英文切换与手机端使用的前沿 AI 模型看板，可查看排行榜、能力雷达图、多模型 Benchmark 折线对比、上下文窗口及实时 Token 价格。

For implementation details and AI-agent handoff, read [`AGENTS.md`](AGENTS.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Features

- 22 frontier and open-weight model configurations
- Chinese / English interface with persistent language preference
- separate rankings for general capability, agent systems, coding systems, human preference, speed, and value
- selectable model dossier and three-model comparison
- evidence-backed seven-axis capability radar with explicit `Not ingested` / partial / broad coverage states
- 31-benchmark catalog spanning reasoning, science, coding, agents, professional work, multimodality, and long context
- multi-model benchmark line charts and raw-score tables by capability family
- model-capability / best-system toggle to prevent harness results being presented as pure model ability
- OpenRouter-backed live token pricing with snapshot fallback
- responsive ranking cards, horizontally scrollable charts, and bottom navigation on mobile
- per-observation provenance: benchmark version, source type, harness, reasoning effort, tool setting, date, and context length

## Data sources

The source registry distinguishes data that already feeds the dashboard from the next ingestion targets. A queued source is visible for transparency but does not affect scores or coverage.

### Connected

- [Artificial Analysis](https://artificialanalysis.ai/leaderboards/models) — independent capability, speed, price, long-context and GDPval references
- [LM Arena](https://arena.ai/leaderboard/text) — large-scale human-preference signal, kept separate from objective capability
- [DeepSWE v1.1](https://deepswe.datacurve.ai/) — benchmark-native long-horizon coding results
- [Google DeepMind model cards](https://deepmind.google/models/gemini/flash/) — vendor results and harness notes
- [DeepSeek V4 model cards](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro) — vendor results and reasoning-effort settings
- [Kimi K3 release table](https://github.com/MoonshotAI/Kimi-K3) — comparison seed only, not the global standard
- [Qwen3.7 release](https://qwen.ai/blog?id=qwen3.7) — vendor results and harness notes
- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties) — live provider pricing and context metadata

### Ingestion queue

- [LiveBench](https://livebench.ai/) — objective, frequently refreshed general evaluation
- [Stanford HELM](https://crfm.stanford.edu/helm/) — transparent and reproducible multi-scenario evaluation
- [ARC Prize verified leaderboard](https://arcprize.org/leaderboard) — verified ARC-AGI results
- [Epoch AI / FrontierMath](https://epoch.ai/frontiermath) — difficult mathematics and methodology cross-checks
- [Terminal-Bench 2.1](https://www.tbench.ai/leaderboard/terminal-bench/2.1) — benchmark-native verified terminal-agent runs
- [OSWorld 2.0](https://github.com/xlang-ai/OSWorld-V2) — execution-based long-horizon computer use
- [SWE-bench](https://www.swebench.com/) — official software-engineering leaderboard and historical continuity

Benchmark observations are stored in `app/model-data.ts` as `model × benchmark × version × harness` records. The ingestion order is benchmark-native leaderboards first, vendor release material for gaps, and independent evaluations for cross-checking. A missing observation is displayed as `Not ingested`, never as a score of zero. Live provider pricing is refreshed through `app/api/live-models/route.ts`; when the upstream request fails, the UI keeps the bundled snapshot.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run check:data
npm run dev:next
```

Open `http://localhost:3000`.

Production validation (the same command EdgeOne Pages runs):

```bash
npm run build
npm run start:next
```

`npm run build` is the canonical production build for EdgeOne Pages. The old Vinext compatibility build remains available as `npm run build:sites`, but is not part of the normal deploy path.

## Deploy to Tencent EdgeOne Pages

GitHub `main` is the single source of truth. EdgeOne Pages watches the branch and deploys the Next.js application and API route directly; a second Sites deployment is not required.

1. Push this repository to GitHub or Gitee.
2. In EdgeOne Makers, choose **Import Git repository**.
3. Select this repository and use Node.js 22.
4. Set the install command to `npm ci`.
5. Set the build command to `npm run build`.
6. Keep the framework preset as Next.js / automatic detection.
7. Deploy, then optionally bind a custom domain.

For a custom domain served from mainland-China acceleration nodes, follow Tencent Cloud's current domain and ICP filing requirements. If you do not yet have an ICP-filed domain, start with the platform preview domain or an overseas/global acceleration region.

## Project structure

```text
app/
  api/live-models/route.ts  # live OpenRouter price adapter
  globals.css               # responsive light interface
  layout.tsx                # metadata and document shell
  model-data.ts             # benchmark snapshots and model metadata
  page.tsx                  # ranking, radar, comparison, pricing UI
public/                     # static assets
docs/ARCHITECTURE.md        # diagrams, data contract, deployment and change playbooks
AGENTS.md                    # concise coding-agent handoff rules
```

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
