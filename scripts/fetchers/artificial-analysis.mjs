// Artificial Analysis, from its documented REST API.
//
// This batch holds **model operating parameters, not benchmark scores** — the same shape as
// batches 06-08. `meta.schema` says so, which is what keeps these rows out of the observation
// store and inside `npm run check:models`, the audit that every catalog number must survive.
//
// It exists to unblock one thing: adding a model. A ModelRecord needs intelligence, cost per
// task, speed, latency and price, and until now those arrived by hand-transcribing AA's model
// pages. Now they arrive with provenance in one call.
//
// ## Why this is NOT in the scheduled refresh
//
// AA re-measures speed and latency continuously — they are live properties of a hosted endpoint,
// not published results frozen at a version. `check:models` fails when a catalog number and its
// archive row disagree by more than 0.005, so wiring this into `--live` would turn the scheduled job
// red every time AA re-ran a benchmark, and the fix would always be a hand edit to
// `app/model-data.ts`. A check that is permanently red is a check nobody reads.
//
// So it runs on demand: `npm run fetch:sources aa`. Do that when onboarding a model, or as a
// deliberate parameters refresh — then read what `check:models` says and decide, per number,
// whether the catalog is stale or AA has drifted. That decision is exactly the editorial work
// AGENTS.md says model records exist to carry.
//
// Requires AA_API_KEY. Free tier covers everything used here.
//
// ⚠ This header used to end: "GDPval-AA and AA-LCR live behind the Pro tier and return 403, so
// those two core benchmarks still have no scripted path." Half of that was wrong and it cost the
// project a column. Measured 2026-08-07 on the same key: `/api/v2/data/llms/models` returns 200
// and carries `lcr` for 488 models. What 403s is `/api/v2/language/models` (no `/free`). AA-LCR
// now has a scripted path and it is `scripts/fetchers/aa-evaluations.mjs`, which reads the
// seventeen-key `evaluations` object this endpoint's three-key version does not have. GDPval-AA
// is still not in either, and is still read by rendering its board (batch 19).

const API = "https://artificialanalysis.ai/api/v2/language/models/free";

// AA suffixes the operating point onto the slug. Splitting it off keeps effort in its own field,
// where check:models looks for it, and leaves one alias per model family.
const EFFORTS = ["non-reasoning", "reasoning", "minimal", "medium", "xhigh", "high", "low", "max"];
const splitEffort = (slug) => {
  for (const effort of EFFORTS) {
    if (slug.endsWith(`-${effort}`)) return { modelRaw: slug.slice(0, -(effort.length + 1)), effort };
  }
  return { modelRaw: slug, effort: null };
};

const round = (value, dp) => (typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(dp)) : null);

export const artificialAnalysis = {
  id: "aa",
  label: "Artificial Analysis model parameters",
  batch: "batch-14-aa-parameters",
  // On demand only — see the header. Never selected by `--live`.
  versioning: "manual",
  available: () => Boolean(process.env.AA_API_KEY),
  unavailableReason: "AA_API_KEY is not set; skipping Artificial Analysis (on-demand source).",

  async fetch() {
    const key = process.env.AA_API_KEY;
    if (!key) throw new Error("AA_API_KEY is not set");

    const models = [];
    let indexVersion = null;
    for (let page = 1; page <= 20; page += 1) {
      const response = await fetch(`${API}?page=${page}`, { headers: { "x-api-key": key } });
      if (response.status === 403) throw new Error("403 from Artificial Analysis — the key lacks access to this endpoint");
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${API}`);
      const payload = await response.json();
      indexVersion ??= payload.intelligence_index_version;
      models.push(...(payload.data ?? []));
      if (!payload.pagination?.has_more) break;
      if (page === 20) throw new Error("more than 20 pages — refusing to loop; the API changed shape");
    }
    if (models.length === 0) throw new Error("the API returned no models");

    const rows = [];
    for (const model of models) {
      const slug = model.slug;
      if (!slug) continue;
      const { modelRaw, effort } = splitEffort(slug);
      const evaluations = model.evaluations ?? {};
      const pricing = model.pricing ?? {};
      const performance = model.performance ?? {};

      rows.push({
        model_raw: modelRaw,
        effort,
        maker: model.model_creator?.name ?? null,
        // AA publishes neither of these; they stay null rather than being inferred, so
        // check:models keeps reporting them as unsourced until a real source supplies them.
        open_weights: null,
        context_k: null,
        intelligence_index: round(evaluations.artificial_analysis_intelligence_index, 1),
        cost_per_task_usd: round(model.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost, 4),
        output_tokens_per_s: round(performance.median_output_tokens_per_second, 2),
        // The catalog's latency field is time to first chunk, which is AA's time to first token.
        // End-to-end response time is a different measurement and must not be substituted.
        latency_first_chunk_s: round(performance.median_time_to_first_token_seconds, 2),
        price_input_per_m: round(pricing.price_1m_input_tokens, 4),
        price_output_per_m: round(pricing.price_1m_output_tokens, 4),
        price_cache_per_m: round(pricing.price_1m_cache_hit_tokens, 4),
        // Arena Elo is not an AA field. Left null so nothing here can satisfy an Elo check.
        text_elo: null,
        code_elo: null,
        evaluation_date: null,
        source_label: `Artificial Analysis API v2 · intelligence index v${indexVersion}`,
        // The model page, not the API path: it is the same publication a reader can open, and it
        // keeps these rows on the existing Artificial Analysis source card.
        source_url: `https://artificialanalysis.ai/models/${slug}`,
        source_kind: "independent",
        note:
          `AA 名称 ${model.name}` +
          (model.release_date ? `；发布 ${model.release_date}` : "") +
          (pricing.price_1m_cache_write_tokens ? `；缓存写入 $${pricing.price_1m_cache_write_tokens}/M` : "") +
          (performance.median_end_to_end_response_time_seconds
            ? `；端到端响应中位数 ${round(performance.median_end_to_end_response_time_seconds, 2)}s`
            : ""),
      });
    }

    return {
      rows,
      version: `index-v${indexVersion}`,
      summary: `${rows.length} configurations across ${new Set(rows.map((r) => r.model_raw)).size} model families, intelligence index v${indexVersion}`,
      meta: {
        batch: "14 · Artificial Analysis parameters",
        collectedWith: "scripts/fetchers/artificial-analysis.mjs",
        filtered: false,
        release: `intelligence index v${indexVersion}`,
        sources: [API, "https://artificialanalysis.ai/leaderboards/models"],
        schema:
          "Model operating parameters, NOT benchmark scores. Supplies intelligence index, cost " +
          "per task, output speed, time to first chunk and vendor pricing for check:models.",
        note:
          "Fetched from Artificial Analysis' documented REST API v2 (free tier) with AA_API_KEY. " +
          "Reasoning effort is split off AA's slug (claude-opus-5-xhigh) into its own field. " +
          "latency_first_chunk_s is AA's median time to FIRST TOKEN; its end-to-end response time " +
          "is a different measurement and is kept in the note rather than substituted. " +
          "text_elo/code_elo stay null because AA does not publish Arena Elo — only LMArena does, " +
          "and nothing here may satisfy an Elo check. open_weights and context_k stay null for " +
          "the same reason: AA's free tier does not publish them, and inferring them would put an " +
          "unsourced number behind a catalog field that check:models currently reports honestly. " +
          "AA's own composite coding and agentic indices are deliberately not archived, for the " +
          "same double-counting reason that dropped aa-intelligence-index. " +
          "This batch is fetched ON DEMAND, never by the scheduled refresh: AA re-measures speed and " +
          "latency continuously, so a scheduled rewrite would fail check:models every time a " +
          "number moved and would need a hand edit to app/model-data.ts to go green again.",
      },
    };
  },
};
