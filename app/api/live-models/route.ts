const LOOKUPS: Record<string, string[]> = {
  "gpt-5.6": ["gpt-5.6", "gpt-5"],
  "claude-opus-5": ["claude-opus-5", "claude-opus"],
  "gemini-3.1-pro": ["gemini-3.1-pro", "gemini-3-pro"],
  "deepseek-v4": ["deepseek-v4", "deepseek"],
  "qwen-4-max": ["qwen-4-max", "qwen-max"],
};

export async function GET() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 240, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const payload = await response.json() as { data?: Array<{ id:string; name?:string; context_length?:number; pricing?:{prompt?:string;completion?:string} }> };
    const list = payload.data ?? [];
    const prices: Record<string, {input:number;output:number;context?:string;source:string}> = {};
    for (const [key, needles] of Object.entries(LOOKUPS)) {
      const found = list.find(item => needles.some(needle => item.id.toLowerCase().includes(needle)));
      if (!found?.pricing) continue;
      const input = Number(found.pricing.prompt ?? 0) * 1_000_000;
      const output = Number(found.pricing.completion ?? 0) * 1_000_000;
      if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
      const n = found.context_length ?? 0;
      prices[key] = { input, output, context: n >= 1_000_000 ? `${Math.round(n/1_000_000)}M` : n ? `${Math.round(n/1000)}K` : undefined, source: found.id };
    }
    return Response.json({ prices, updatedAt: new Date().toISOString(), provider: "OpenRouter" }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=240" } });
  } catch {
    return Response.json({ error: "Live price feed unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
