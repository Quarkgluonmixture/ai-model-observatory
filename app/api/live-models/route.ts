const LOOKUPS: Record<string, string[]> = {
  "claude-opus-5": ["claude-opus-5"],
  "claude-fable-5": ["claude-fable-5"],
  "gpt-5.6-sol": ["gpt-5.6-sol", "gpt-5.6"],
  "kimi-k3": ["kimi-k3"],
  "gpt-5.6-terra": ["gpt-5.6-terra"],
  "grok-4.5": ["grok-4.5"],
  "claude-sonnet-5": ["claude-sonnet-5"],
  "glm-5.2": ["glm-5.2"],
  "muse-spark-1.1": ["muse-spark-1.1"],
  "gemini-3.5-flash": ["gemini-3.5-flash"],
  "gemini-3.6-flash": ["gemini-3.6-flash"],
  "deepseek-v4-flash": ["deepseek-v4-flash", "deepseek-v4"],
  "gemini-3.1-pro": ["gemini-3.1-pro"],
  "qwen3.7-max": ["qwen3.7-max", "qwen-3.7-max"],
  "deepseek-v4-pro": ["deepseek-v4-pro", "deepseek-v4"],
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
    const prices: Record<string, {input:number;output:number;contextK?:number;source:string}> = {};
    for (const [key, needles] of Object.entries(LOOKUPS)) {
      const found = list.find(item => needles.some(needle => item.id.toLowerCase().includes(needle)));
      if (!found?.pricing) continue;
      const input = Number((Number(found.pricing.prompt ?? 0) * 1_000_000).toFixed(6));
      const output = Number((Number(found.pricing.completion ?? 0) * 1_000_000).toFixed(6));
      if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
      const n = found.context_length ?? 0;
      prices[key] = { input, output, contextK: n ? Math.round(n/1000) : undefined, source: found.id };
    }
    return Response.json({ prices, updatedAt: new Date().toISOString(), provider: "OpenRouter" }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=240" } });
  } catch {
    return Response.json({ error: "Live price feed unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
