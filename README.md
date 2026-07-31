# AI Model Observatory · AI 模型观测站

A bilingual, mobile-ready dashboard for comparing frontier AI models across versioned capability benchmarks, best-available agent systems, human-preference rankings, throughput, context windows, and token prices.

一个支持中英文切换与手机端使用的前沿 AI 模型看板，可查看排行榜、能力雷达图、多模型 Benchmark 折线对比、上下文窗口及实时 Token 价格。

## Features

- 22 frontier and open-weight model configurations
- Chinese / English interface with persistent language preference
- separate rankings for general capability, agent systems, coding systems, human preference, speed, and value
- selectable model dossier and three-model comparison
- evidence-backed seven-axis capability radar with explicit coverage
- 31-benchmark catalog spanning reasoning, science, coding, agents, professional work, multimodality, and long context
- multi-model benchmark line charts and raw-score tables by capability family
- model-capability / best-system toggle to prevent harness results being presented as pure model ability
- OpenRouter-backed live token pricing with snapshot fallback
- responsive ranking cards, horizontally scrollable charts, and bottom navigation on mobile

## Data sources

- [LM Arena — Text](https://arena.ai/leaderboard/text)
- [LM Arena — Code / WebDev](https://arena.ai/leaderboard/code/webdev)
- [Artificial Analysis — Model Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- [Kimi K3 — public cross-model evaluation table](https://github.com/MoonshotAI/Kimi-K3)
- [DeepSWE v1.1](https://github.com/datacurve-ai/deep-swe)
- [Terminal-Bench 2.1](https://www.tbench.ai/leaderboard/terminal-bench/2.1)
- [MCP-Atlas](https://github.com/scaleapi/mcp-atlas)
- [Toolathlon](https://github.com/hkust-nlp/Toolathlon)
- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)
- [LiveBench](https://livebench.ai/)

Benchmark snapshots are stored in `app/model-data.ts`. Live provider pricing is refreshed through `app/api/live-models/route.ts`; when the upstream request fails, the UI keeps the bundled snapshot.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev:next
```

Open `http://localhost:3000`.

Production validation:

```bash
npm run build:next
npm run start:next
```

The existing `npm run build` command is retained for the OpenAI Sites / Vinext deployment target.

## Deploy to Tencent EdgeOne Makers

EdgeOne Makers supports Git-connected Next.js applications and API routes, so this project can be deployed without removing the live pricing endpoint.

1. Push this repository to GitHub or Gitee.
2. In EdgeOne Makers, choose **Import Git repository**.
3. Select this repository and use Node.js 22.
4. Set the install command to `npm ci`.
5. Set the build command to `npm run build:next`.
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
```

## Notes

- Metrics from different sources are not blended into a hidden universal score.
- Arena remains a separate human-preference signal rather than a capability axis.
- Raw benchmark values, versions, evaluation object, and scoring method remain visible.
- Missing source values remain `N/A`; the radar never zero-fills or estimates a missing axis.
- Agentic results can depend on the model snapshot, harness, tools, reasoning effort, budget, and number of attempts.
- Upstream leaderboards and provider pricing change over time, so dated snapshots should be refreshed deliberately.

## License

No open-source license has been selected yet. All rights reserved unless a license is added by the repository owner.
