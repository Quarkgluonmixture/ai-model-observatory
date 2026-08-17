import { activationMetrics, type PersonaRun } from "@/app/persona/protocol";
import {
  authorizePersonaRequest,
  callQwen,
  errorResponse,
} from "../_server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const denied = await authorizePersonaRequest(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      encoding?: unknown;
      probes?: unknown;
      repetitions?: unknown;
    };
    const encoding = typeof body.encoding === "string" ? body.encoding.trim() : "";
    const probes = Array.isArray(body.probes)
      ? body.probes.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];
    const repetitions = Number(body.repetitions ?? 1);
    if (!encoding.startsWith("【PERSONA_LOAD】\n") || encoding.length > 12_000) {
      return Response.json(
        { error: "候选编码无效或过长。" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!probes.length || probes.length > 6 || probes.some((probe) => probe.length > 2_000)) {
      return Response.json(
        { error: "每次实验需要 1 到 6 个探针，每个探针最多 2,000 个字符。" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3) {
      return Response.json(
        { error: "重复次数必须是 1 到 3 之间的整数。" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const planned = probes.length * repetitions;
    if (planned > 6) {
      return Response.json(
        { error: "一次最多执行 6 次模型调用，请减少探针或重复次数。" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const jobs = probes.flatMap((probe) =>
      Array.from({ length: repetitions }, (_, repetition) => ({ probe, repetition: repetition + 1 })),
    );
    const runs: PersonaRun[] = [];
    for (let index = 0; index < jobs.length; index += 2) {
      const batch = jobs.slice(index, index + 2);
      const results = await Promise.all(
        batch.map(async ({ probe, repetition }) => {
          const messages = [
            { role: "system" as const, content: encoding },
            { role: "user" as const, content: probe },
          ];
          const call = await callQwen(messages, { max_tokens: 2048, enable_thinking: true });
          const analysis = activationMetrics(call.reasoningContent, call.content);
          return {
            run_id: await runId(encoding, probe, repetition, call.response.id),
            timestamp: new Date().toISOString(),
            provider: "qwen" as const,
            model: call.model,
            probe_text: probe,
            repetition,
            persona_prompt: encoding,
            messages,
            reasoning_content: call.reasoningContent,
            content: call.content,
            usage: call.response.usage ?? {},
            latency_ms: call.latencyMs,
            api_parameters: Object.fromEntries(
              Object.entries(call.requestPayload).filter(([key]) => key !== "messages"),
            ),
            raw_response: call.response,
            metrics: analysis.metrics,
            reasoning_spans: analysis.spans,
          } satisfies PersonaRun;
        }),
      );
      runs.push(...results);
    }
    return Response.json(
      { runs, call_count: runs.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function runId(
  encoding: string,
  probe: string,
  repetition: number,
  upstreamId: unknown,
): Promise<string> {
  const input = JSON.stringify({ encoding, probe, repetition, upstreamId, timestamp: Date.now() });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].slice(0, 16).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
