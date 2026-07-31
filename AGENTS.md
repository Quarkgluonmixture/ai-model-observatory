# AI Model Observatory — Agent Handoff

Read `docs/ARCHITECTURE.md` before making structural or data changes.

## Mission

Maintain a bilingual, mobile-first AI model observatory with honest evidence semantics. The dashboard must separate model capability, best-system performance, human preference, speed, and price rather than hiding them inside one universal score.

## Non-negotiable rules

1. Missing benchmark evidence is `N/A` / `Not ingested`, never numeric zero.
2. Every benchmark score must originate from a `BenchmarkObservation` with source, version, date, harness, reasoning effort, and tools metadata where known.
3. Prefer sources in this order: benchmark-native leaderboard, independent evaluator, vendor release material. Vendor comparison tables may fill gaps but must not become the global standard.
4. Do not mix incompatible benchmark versions, context lengths, tool settings, or harnesses as if they were identical.
5. Arena Elo is human preference, not task accuracy. Keep it separate from benchmark capability.
6. System benchmarks reflect model + scaffold + tools + budget. Keep model and best-system views distinct.
7. Preserve Chinese/English UI parity and mobile behavior.
8. GitHub `main` is the source of truth. EdgeOne Pages is the production host. Do not create a second production deployment unless explicitly requested.

## Required checks

```bash
npm ci
npm run lint
npm run check:data
npm run build
```

## High-value files

- `app/model-data.ts`: models, benchmark catalog, structured observations, source metadata.
- `app/page.tsx`: ranking, coverage semantics, radar, comparison, bilingual UI.
- `app/api/live-models/route.ts`: OpenRouter price refresh with bundled fallback.
- `app/globals.css`: desktop/mobile visual system.
- `scripts/check-model-data.mjs`: CI-enforced data contract.
- `docs/ARCHITECTURE.md`: system architecture and change playbooks.

## Safe change sequence

1. Verify current primary sources.
2. Add or update catalog/model records.
3. Add structured observations; do not directly hand-edit derived scores.
4. Run all required checks.
5. Review desktop and mobile layouts on the deployed EdgeOne preview URL.
6. Update README or architecture docs if behavior or schema changed.
