// The canonical OpenRouter id for each catalog model, exact — never a substring.
//
// Substring matching looked harmless and was not. `list.find` returns the first entry that
// contains the needle, and OpenRouter serves several products whose ids contain each other:
// the needle "gpt-5.6" matched `openai/gpt-5.6-luna-pro`, so the GPT-5.6 Sol card rendered
// Luna Pro's $0.10/$0.60 in place of Sol's $5/$30. Six other lookups landed on a `-fast`,
// `-pro` or `-lite` variant the same way. None of it was visible: a wrong price looks exactly
// like a right one.
//
// So a lookup is now one exact provider id. A retired or renamed id resolves to nothing and
// the card keeps its archived price, which is the safe direction to fail in. `npm run
// report:gaps` reports both a dead lookup and a catalog model that has no lookup at all —
// this table cannot silently stop covering a model.
// The extension is required, not stylistic: `scripts/report-gaps.mjs` imports this file, and Node
// resolving app→app has no bundler to guess it. tsconfig has `allowImportingTsExtensions`.
import { tierWordOf, variantOf } from "../../upstream-variants.ts";

export const PROVIDER_LOOKUPS: Record<string, string> = {
  "claude-opus-5": "anthropic/claude-opus-5",
  "claude-opus-4.8": "anthropic/claude-opus-4.8",
  "claude-fable-5": "anthropic/claude-fable-5",
  "claude-sonnet-5": "anthropic/claude-sonnet-5",
  "gpt-5.6-sol": "openai/gpt-5.6-sol",
  "gpt-5.6-terra": "openai/gpt-5.6-terra",
  "gpt-5.6-luna": "openai/gpt-5.6-luna",
  "gpt-5.5": "openai/gpt-5.5",
  "gemini-3.6-flash": "google/gemini-3.6-flash",
  "gemini-3.5-flash": "google/gemini-3.5-flash",
  // The catalog carries the preview, so the lookup names it. `-customtools` is a separate
  // deployment of the same model and is not what the catalog measured.
  "gemini-3.1-pro": "google/gemini-3.1-pro-preview",
  "gemini-3-flash": "google/gemini-3-flash-preview",
  "grok-4.5": "x-ai/grok-4.5",
  "grok-4.3": "x-ai/grok-4.3",
  "glm-5.2": "z-ai/glm-5.2",
  "muse-spark-1.1": "meta/muse-spark-1.1",
  "kimi-k3": "moonshotai/kimi-k3",
  "kimi-k2.6": "moonshotai/kimi-k2.6",
  "kimi-k2.7-code": "moonshotai/kimi-k2.7-code",
  // The catalog tracks the dated snapshot, which upstream also serves undated. They are
  // different rows with different prices; the dated one is the one that was measured.
  "deepseek-v4-flash": "deepseek/deepseek-v4-flash-0731",
  "deepseek-v4-pro": "deepseek/deepseek-v4-pro",
  "qwen3.8-max": "qwen/qwen3.8-max",
  "qwen3.7-plus": "qwen/qwen3.7-plus",
  "qwen3.7-max": "qwen/qwen3.7-max",
  "qwen3.6-plus": "qwen/qwen3.6-plus",
  "qwen3.6-max": "qwen/qwen3.6-max-preview",
  "minimax-m3": "minimax/minimax-m3",
  "inkling": "thinkingmachines/inkling",
  "inkling-small": "thinkingmachines/inkling-small",
};

export async function GET() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 240, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const payload = await response.json() as { data?: Array<{ id:string; name?:string; created?:number; context_length?:number; architecture?:{output_modalities?:string[]}; pricing?:{prompt?:string;completion?:string} }> };
    const list = payload.data ?? [];
    const byId = new Map(list.map(item => [item.id.toLowerCase(), item]));
    const prices: Record<string, {input:number;output:number;contextK?:number;source:string}> = {};
    for (const [key, providerId] of Object.entries(PROVIDER_LOOKUPS)) {
      const found = byId.get(providerId);
      if (!found?.pricing) continue;
      const input = Number((Number(found.pricing.prompt ?? 0) * 1_000_000).toFixed(6));
      const output = Number((Number(found.pricing.completion ?? 0) * 1_000_000).toFixed(6));
      if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
      const n = found.context_length ?? 0;
      prices[key] = { input, output, contextK: n ? Math.round(n/1000) : undefined, source: found.id };
    }
    // The same request already carries every model this provider serves, and until now all but
    // 27 of them were thrown away. A model published in a namespace the catalog already resolves
    // is the earliest signal that exists that something new shipped — earlier than the daily job,
    // which finds it tomorrow morning. So it is reported here too.
    //
    // Reported, never ingested. A runtime number has no archive row behind it and can never
    // become a catalog number; this is the same rule the price card follows when it shows a
    // provider figure beside the archived one instead of overwriting it. What the reader gets is
    // "something is new upstream", which is true, and a date they can check.
    //
    // It is not a defect list, and it is not a queue. A model enters the catalog only with archived
    // rows behind it, so a name here is a lead for the next collection pass, not work overdue. The
    // reader is told that in `freshNote` and the whole block is folded shut, because eight names
    // under an unfolded heading read as eight things wrong.
    const tracked = new Set(Object.values(PROVIDER_LOOKUPS));
    const namespaces = new Set(Object.values(PROVIDER_LOOKUPS).map(id => id.split("/")[0]));
    const cutoff = Date.now() / 1000 - 60 * 24 * 60 * 60;
    const candidates = list
      .filter(item => namespaces.has(item.id.split("/")[0]))
      .filter(item => !tracked.has(item.id.toLowerCase()))
      // An operating point or a price tier of a model is not a model. Both filters are the shared
      // ones in `app/upstream-variants.ts`, so this list and `npm run report:gaps` cannot disagree
      // about what counts again.
      .filter(item => !variantOf(item.id))
      .filter(item => !tierWordOf(item.name))
      // This catalog measures models that answer in text. An image generator served by a maker we
      // track is not a gap in it — Nano Banana 2 Lite sitting in a list headed "not yet in this
      // catalog" reads as work outstanding, and it is not. The provider states the modality, so
      // this is a fact rather than a guess about the name.
      .filter(item => {
        const out = item.architecture?.output_modalities;
        return !out || (out.includes("text") && !out.includes("image"));
      })
      .filter(item => typeof item.created === "number" && item.created >= cutoff)
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

    // The cap is a layout limit, so the number it cut is reported beside it. Measured 2026-08-10:
    // this cap used to be the last filter, and the five tier rows above were spending five of its
    // eight slots — `GPT-5.6 Luna Pro`, `Terra Pro` and `Sol Pro` were all real models, all absent
    // from the catalog, and all pushed off the end of the list by noise. A silent truncation reads
    // as "that is all of them".
    const fresh = candidates
      .slice(0, 8)
      .map(item => ({ id: item.id, name: item.name ?? item.id, published: new Date((item.created ?? 0) * 1000).toISOString().slice(0, 10) }));

    return Response.json({ prices, fresh, freshTotal: candidates.length, updatedAt: new Date().toISOString(), provider: "OpenRouter" }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=240" } });
  } catch {
    return Response.json({ error: "Live price feed unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
