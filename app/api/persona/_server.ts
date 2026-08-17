import "server-only";

import {
  COMPILER_VERSION,
  DEFAULT_QWEN_MODEL,
  type CompileResult,
  type PersonaCandidate,
  type PersonaFact,
  normalizeCompilerOutput,
  validateCompilerOutput,
} from "@/app/persona/protocol";

const DEFAULT_BASE_URL =
  "https://ws-6a5u6wax9sdbb1n9.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

export const COMPILER_SYSTEM = `ENCODE_PERSONA_COMPILER_V2
You compile a natural-language persona specification into candidate Encode Persona IR.

SOURCE FIDELITY
- Treat the supplied prompt as the only source of truth.
- Extract a fact ledger before encoding. Mark each fact explicit or inferred and include a short source quote of at most 32 characters. Prompt language alone does not create a LANG policy.
- Preserve exact distinctions: preferred versus maximum, default versus exception, trigger versus state, permission versus requirement, and soft style versus hard policy.
- Never silently strengthen, weaken, merge, translate, or discard an explicit constraint.

ENCODE PERSONA OUTPUT CONTRACT
- Every candidate is the SAME language: first line exactly 【PERSONA_LOAD】, followed only by uppercase underscore-delimited semantic tags, one tag per line.
- Every alphabetic character inside a tag must be uppercase, including transliterated names and proper nouns.
- No key/value syntax, colons, equals signs, JSON, YAML, bullets, prose sentences, definitions, mappings, comments, or Markdown may occur inside encoding.
- Candidates vary only granularity: candidate_001 canonical medium, candidate_002 compact gestalt, candidate_003 atomized fine. Additional candidates remain in this grammar.
- Every candidate covers every explicit fact. Compression may compose atoms but not omit meaning.
- Do not claim that any candidate is optimal.
- Keep each rationale to one short sentence. Return compact JSON without Markdown or extra prose.

Return one JSON object only:
{
  "extraction": {
    "facts": [
      {"fact_id":"F001","certainty":"explicit|inferred","source_quote":"...",
       "atoms":["IDENTITY_..."],"critical":true}
    ]
  },
  "candidates": [
    {"candidate_id":"candidate_001","profile":"canonical_medium",
     "encoding":"【PERSONA_LOAD】\\nIDENTITY_...",
     "covered_fact_ids":["F001"],"rationale":"..."}
  ]
}
Return exactly the requested number of candidates.`;

const ONTOLOGY = {
  version: "0.1",
  status: "experimental",
  namespaces: {
    IDENTITY: "entity or social role",
    BODY: "embodiment or physical features relevant to behavior",
    SELF: "self-concept or self-claim",
    LANG: "output language or language policy",
    PERSONALITY: "persistent behavioral tendencies",
    SPEECH: "surface register, tone, and phrasing",
    RELATION: "relation to a conversational participant",
    PREFERENCE: "positive or negative preference",
    DRIVE: "goal-generating tendency",
    POLICY: "durable behavioral policy",
    TRAIT: "property or invariant not captured by a narrower namespace",
    TRIGGER: "observation that may initiate a state transition",
    STATE: "conditional or transient behavioral state",
    RESPONSE: "response associated with a trigger or boundary",
    MODE: "broad active behavior mode",
    PROTOCOL: "interaction-level signaling behavior",
  },
};

const GRAMMAR = {
  version: "0.2.1",
  status: "experimental",
  wrapper: "【PERSONA_LOAD】",
  tag_pattern: "^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$",
  candidate_profiles: {
    candidate_001: "canonical_medium",
    candidate_002: "compact_gestalt",
    candidate_003: "atomized_fine",
  },
  semantic_contract: [
    "Every non-wrapper line is one uppercase underscore-delimited semantic tag.",
    "Candidates vary semantic granularity, not representation family.",
    "Every explicit source fact remains covered in every candidate.",
    "Preferred values, hard maxima, triggers, states, and exceptions remain distinct.",
    "Prompt language alone never implies an output-language policy.",
    "Inferred facts are labeled inferred and are not silently compiled as explicit facts.",
  ],
};

type QwenMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type QwenResponse = {
  id?: string;
  model?: string;
  created?: number;
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: Record<string, unknown>;
  error?: { message?: string; code?: string };
  [key: string]: unknown;
};

export type QwenCallResult = {
  response: QwenResponse;
  content: string;
  reasoningContent: string;
  model: string;
  latencyMs: number;
  requestPayload: Record<string, unknown>;
};

export function personaServiceStatus() {
  return {
    configured: Boolean(qwenApiKey()),
    protected: Boolean(process.env.PERSONA_ACCESS_TOKEN),
    provider: "qwen" as const,
    model: qwenModel(),
    compiler_version: COMPILER_VERSION,
  };
}

export async function authorizePersonaRequest(request: Request): Promise<Response | null> {
  const configured = process.env.PERSONA_ACCESS_TOKEN;
  if (!configured) {
    return Response.json(
      { error: "PERSONA_ACCESS_TOKEN 未配置，服务保持关闭。" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const supplied = request.headers.get("x-persona-access-token") ?? "";
  // Header values are byte strings in browsers. Encode the user-entered passphrase so a
  // deliberately chosen CJK token (the production token is Chinese) remains portable.
  if (!(await equalSecret(supplied, encodeURIComponent(configured)))) {
    return Response.json(
      { error: "访问口令无效。" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}

export function buildCompilerMessages(description: string, candidateCount: number): QwenMessage[] {
  return [
    { role: "system", content: COMPILER_SYSTEM },
    {
      role: "user",
      content: JSON.stringify({
        candidate_count: candidateCount,
        ontology_status: "experimental_working_vocabulary",
        ontology: ONTOLOGY,
        encode_persona_grammar: GRAMMAR,
        character_description: description,
      }),
    },
  ];
}

export async function compilePersona(
  description: string,
  candidateCount: number,
): Promise<CompileResult> {
  const messages = buildCompilerMessages(description, candidateCount);
  // Compilation needs structured output, not a long observable reasoning trace. Disabling
  // thinking keeps the request inside EdgeOne's production function window; target-model
  // experiments remain in thinking mode so activation metrics still have a trace to inspect.
  const call = await callQwen(messages, { max_tokens: 4096, enable_thinking: false });
  const parsed = parseJsonObject(call.content);
  const normalized = normalizeCompilerOutput(parsed);
  const validation = validateCompilerOutput(normalized.value, candidateCount);
  if (!validation.valid) {
    throw new PersonaUpstreamError(
      "Qwen 返回了候选，但没有通过 Encode Persona 结构校验。",
      422,
      { validation, content: call.content, reasoning_content: call.reasoningContent },
    );
  }
  const object = normalized.value as {
    extraction: { facts: PersonaFact[] };
    candidates: PersonaCandidate[];
  };
  return {
    extraction: object.extraction,
    candidates: object.candidates,
    validation,
    provenance: {
      compiler_version: COMPILER_VERSION,
      provider: "qwen",
      model: call.model,
      timestamp: new Date().toISOString(),
      request_id: typeof call.response.id === "string" ? call.response.id : null,
      latency_ms: call.latencyMs,
      usage: call.response.usage ?? {},
      reasoning_content: call.reasoningContent,
      normalizations: normalized.normalizations,
    },
    request: {
      model: qwenModel(),
      messages,
      parameters: withoutMessages(call.requestPayload),
    },
    raw_response: call.response,
  };
}

export async function callQwen(
  messages: QwenMessage[],
  parameters: { max_tokens: number; enable_thinking: boolean },
): Promise<QwenCallResult> {
  const apiKey = qwenApiKey();
  if (!apiKey) throw new PersonaUpstreamError("QWEN_API_KEY 未配置。", 503);
  const requestPayload = {
    model: qwenModel(),
    messages,
    stream: false,
    ...parameters,
  };
  const started = performance.now();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${qwenBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(90_000),
        cache: "no-store",
      });
      const rawText = await response.text();
      const payload = safeJson(rawText) as QwenResponse;
      if (!response.ok) {
        const message = payload.error?.message || rawText.slice(0, 500) || `HTTP ${response.status}`;
        if (RETRYABLE_STATUSES.has(response.status) && attempt < 2) {
          await delay(500 * 2 ** attempt);
          continue;
        }
        throw new PersonaUpstreamError(`Qwen 请求失败：${message}`, response.status, payload);
      }
      const message = payload.choices?.[0]?.message;
      const content = typeof message?.content === "string" ? message.content : "";
      if (!content) throw new PersonaUpstreamError("Qwen 返回了空 content。", 502, payload);
      return {
        response: payload,
        content,
        reasoningContent:
          typeof message?.reasoning_content === "string" ? message.reasoning_content : "",
        model: typeof payload.model === "string" ? payload.model : qwenModel(),
        latencyMs: Math.round(performance.now() - started),
        requestPayload,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof PersonaUpstreamError) throw error;
      if (attempt < 2) {
        await delay(500 * 2 ** attempt);
        continue;
      }
    }
  }
  throw new PersonaUpstreamError(
    `Qwen 请求失败：${lastError instanceof Error ? lastError.message : "未知网络错误"}`,
    502,
  );
}

export class PersonaUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PersonaUpstreamError";
  }
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) throw new PersonaUpstreamError("Qwen 未返回 JSON 对象。", 422, { content: text });
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PersonaUpstreamError("Qwen 返回的 JSON 顶层不是对象。", 422, { content: text });
  }
  return parsed as Record<string, unknown>;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof PersonaUpstreamError) {
    return Response.json(
      { error: error.message, details: error.details ?? null },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  const message = error instanceof Error ? error.message : "未知错误";
  return Response.json(
    { error: message },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

function qwenApiKey(): string {
  return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "";
}

function qwenBaseUrl(): string {
  return (process.env.QWEN_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function qwenModel(): string {
  return process.env.QWEN_MODEL || DEFAULT_QWEN_MODEL;
}

async function equalSecret(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  if (leftHash.length !== rightHash.length) return false;
  let result = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    result |= leftHash[index] ^ rightHash[index];
  }
  return result === 0;
}

async function digest(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { error: { message: value.slice(0, 500) } };
  }
}

function withoutMessages(payload: Record<string, unknown>): Record<string, unknown> {
  const { messages: _messages, ...rest } = payload;
  void _messages;
  return rest;
}
