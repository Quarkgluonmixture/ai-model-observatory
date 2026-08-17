export const PERSONA_WRAPPER = "【PERSONA_LOAD】";
export const COMPILER_VERSION = "compiler-v2.1-web";
export const DEFAULT_QWEN_MODEL = "qwen3.7-flash";

export type PersonaFact = {
  fact_id: string;
  certainty: "explicit" | "inferred";
  source_quote: string;
  atoms: string[];
  critical: boolean;
};

export type PersonaCandidate = {
  candidate_id: string;
  profile: string;
  encoding: string;
  covered_fact_ids: string[];
  rationale: string;
};

export type CandidateValidation = {
  candidate_id: string;
  valid: boolean;
  errors: string[];
  tag_count: number;
  explicit_fact_coverage: number | null;
};

export type CompileResult = {
  extraction: { facts: PersonaFact[] };
  candidates: PersonaCandidate[];
  validation: {
    valid: boolean;
    errors: string[];
    candidates: CandidateValidation[];
  };
  provenance: {
    compiler_version: string;
    provider: "qwen";
    model: string;
    timestamp: string;
    request_id: string | null;
    latency_ms: number;
    usage: Record<string, unknown>;
    reasoning_content: string;
  };
  request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    parameters: Record<string, unknown>;
  };
  raw_response: Record<string, unknown>;
};

export type ReasoningLabel =
  | "META_PROMPT_INTERPRETATION"
  | "PERSONA_RECONSTRUCTION"
  | "IN_CHARACTER_REASONING"
  | "TASK_REASONING"
  | "OTHER";

export type ReasoningSpan = {
  start: number;
  end: number;
  text: string;
  label: ReasoningLabel;
  matched_rule: string;
};

export type ActivationMetrics = {
  pal_heuristic: number | null;
  mrr_lexical: number | null;
  icrr_heuristic: number | null;
  dpe_heuristic: boolean | null;
  persona_leakage_lexical: boolean;
  reasoning_units: number;
};

export type PersonaRun = {
  run_id: string;
  timestamp: string;
  provider: "qwen";
  model: string;
  probe_text: string;
  repetition: number;
  persona_prompt: string;
  messages: Array<{ role: string; content: string }>;
  reasoning_content: string;
  content: string;
  usage: Record<string, unknown>;
  latency_ms: number;
  api_parameters: Record<string, unknown>;
  raw_response: Record<string, unknown>;
  metrics: ActivationMetrics;
  reasoning_spans: ReasoningSpan[];
};

const TAG_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const FACT_ID_PATTERN = /^F[0-9]+$/;
const PROFILE_BY_ID: Record<string, string> = {
  candidate_001: "canonical_medium",
  candidate_002: "compact_gestalt",
  candidate_003: "atomized_fine",
};

export function validateCompilerOutput(
  value: unknown,
  expectedCandidateCount: number,
): CompileResult["validation"] {
  const errors: string[] = [];
  const object = asRecord(value);
  const extraction = asRecord(object?.extraction);
  const facts = Array.isArray(extraction?.facts) ? extraction.facts : [];
  const explicitIds = new Set<string>();
  const allFactIds = new Set<string>();

  if (!facts.length) errors.push("extraction.facts 必须是非空数组");
  for (const [index, rawFact] of facts.entries()) {
    const fact = asRecord(rawFact);
    const id = typeof fact?.fact_id === "string" ? fact.fact_id : "";
    if (!FACT_ID_PATTERN.test(id)) errors.push(`fact ${index + 1} 的 fact_id 无效`);
    if (allFactIds.has(id)) errors.push(`fact_id 重复：${id}`);
    if (id) allFactIds.add(id);
    if (fact?.certainty === "explicit") explicitIds.add(id);
    if (fact?.certainty !== "explicit" && fact?.certainty !== "inferred") {
      errors.push(`fact ${id || index + 1} 的 certainty 无效`);
    }
    if (typeof fact?.source_quote !== "string" || !fact.source_quote.trim()) {
      errors.push(`fact ${id || index + 1} 缺少 source_quote`);
    }
    const atoms = Array.isArray(fact?.atoms) ? fact.atoms : [];
    if (!atoms.length || atoms.some((atom) => typeof atom !== "string" || !TAG_PATTERN.test(atom))) {
      errors.push(`fact ${id || index + 1} 的 atoms 无效`);
    }
  }

  const rawCandidates = Array.isArray(object?.candidates) ? object.candidates : [];
  if (rawCandidates.length !== expectedCandidateCount) {
    errors.push(`预期 ${expectedCandidateCount} 个候选，实际 ${rawCandidates.length} 个`);
  }
  const candidateResults: CandidateValidation[] = [];
  const counts = new Map<string, number>();

  for (const [index, rawCandidate] of rawCandidates.entries()) {
    const candidate = asRecord(rawCandidate);
    const expectedId = `candidate_${String(index + 1).padStart(3, "0")}`;
    const id = typeof candidate?.candidate_id === "string" ? candidate.candidate_id : expectedId;
    const candidateErrors: string[] = [];
    if (id !== expectedId) candidateErrors.push(`candidate_id 必须是 ${expectedId}`);
    const expectedProfile = PROFILE_BY_ID[id] ?? "experimental_variant";
    if (candidate?.profile !== expectedProfile) candidateErrors.push(`profile 必须是 ${expectedProfile}`);

    const encoding = typeof candidate?.encoding === "string" ? candidate.encoding : "";
    const lines = encoding.replace(/\r\n/g, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    if (lines[0] !== PERSONA_WRAPPER) candidateErrors.push(`首行必须是 ${PERSONA_WRAPPER}`);
    const tags = lines.slice(1);
    if (!tags.length) candidateErrors.push("候选必须至少包含一个标签");
    for (const tag of tags) {
      if (!TAG_PATTERN.test(tag)) candidateErrors.push(`无效标签：${tag || "<空行>"}`);
    }

    const covered = Array.isArray(candidate?.covered_fact_ids)
      ? new Set(candidate.covered_fact_ids.filter((item): item is string => typeof item === "string"))
      : new Set<string>();
    const missing = [...explicitIds].filter((idValue) => !covered.has(idValue));
    const unknown = [...covered].filter((idValue) => !allFactIds.has(idValue));
    if (missing.length) candidateErrors.push(`未覆盖显式事实：${missing.join(", ")}`);
    if (unknown.length) candidateErrors.push(`引用未知事实：${unknown.join(", ")}`);
    counts.set(id, tags.length);
    candidateResults.push({
      candidate_id: id,
      valid: candidateErrors.length === 0,
      errors: candidateErrors,
      tag_count: tags.length,
      explicit_fact_coverage: explicitIds.size
        ? [...explicitIds].filter((idValue) => covered.has(idValue)).length / explicitIds.size
        : null,
    });
  }

  if ((counts.get("candidate_002") ?? 0) > (counts.get("candidate_001") ?? 0)) {
    errors.push("compact 候选的标签数不能多于 canonical 候选");
  }
  if ((counts.get("candidate_001") ?? 0) > (counts.get("candidate_003") ?? Number.POSITIVE_INFINITY)) {
    errors.push("atomized 候选的标签数不能少于 canonical 候选");
  }
  return {
    valid: errors.length === 0 && candidateResults.every((candidate) => candidate.valid),
    errors,
    candidates: candidateResults,
  };
}

const LABEL_RULES: Array<{
  label: ReasoningLabel;
  patterns: RegExp[];
}> = [
  {
    label: "META_PROMPT_INTERPRETATION",
    patterns: [
      /用户(?:要求|提供|希望|想要)/i,
      /根据(?:设定|提示|角色|persona)/i,
      /(?:我要|我需要|应该)(?:扮演|遵循|按照|使用中文|回答)/i,
      /(?:我们)?需要回答用户/i,
      /(?:需要|应该|必须|应)(?:以|保持|符合).*?(?:人设|角色|设定)/i,
      /角色(?:要求|设定|扮演)/i,
      /(?:system|developer|persona)\s*(?:prompt|message|instruction)/i,
      /role[- ]?play|act as|the user (?:wants|provided|asks)/i,
      /I (?:need|should|will) (?:follow|act|respond|role-play|interpret)/i,
    ],
  },
  {
    label: "PERSONA_RECONSTRUCTION",
    patterns: [
      /(?:这个|该)?(?:角色|人物|persona)(?:是|有|具有)/i,
      /(?:设定|标签|编码)(?:表示|意味着|包含)/i,
      /(?:性格|身份|特征)(?:是|包括|包含)/i,
      /the persona (?:is|has|means|includes)/i,
      /the (?:tag|encoding|specification) (?:means|indicates|contains)/i,
    ],
  },
  {
    label: "IN_CHARACTER_REASONING",
    patterns: [
      /主人|本小姐|人家|咱的|我的(?:尾鳍|尾巴|耳朵)/i,
      /才不是|才没有|别误会|真让人操心/i,
      /替您|为您|陪您|给您|给主人|给他泡/i,
      /master\b|my (?:tail|ears)|dear master/i,
    ],
  },
  {
    label: "TASK_REASONING",
    patterns: [/首先|然后|接下来|计算|答案|问题|需要检查/i, /first|next|calculate|the answer|the question|need to check/i],
  },
];

export function segmentReasoning(text: string): ReasoningSpan[] {
  const spans: ReasoningSpan[] = [];
  for (const match of text.matchAll(/[^。！？!?\n]+[。！？!?]?|\n/g)) {
    const chunk = match[0];
    if (chunk === "\n" || !chunk.trim()) continue;
    let label: ReasoningLabel = "OTHER";
    let matchedRule = "no_lexical_rule";
    for (const rule of LABEL_RULES) {
      const pattern = rule.patterns.find((candidate) => candidate.test(chunk));
      if (!pattern) continue;
      label = rule.label;
      matchedRule = pattern.source;
      break;
    }
    spans.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + chunk.length,
      text: chunk,
      label,
      matched_rule: matchedRule,
    });
  }
  return spans;
}

export function approximateUnits(text: string): number {
  return text.match(/[\u3400-\u9fff]|[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)?|[^\s]/g)?.length ?? 0;
}

export function activationMetrics(reasoning: string, content: string): {
  metrics: ActivationMetrics;
  spans: ReasoningSpan[];
} {
  const spans = segmentReasoning(reasoning);
  const total = approximateUnits(reasoning);
  const unitsFor = (label: ReasoningLabel) =>
    spans.filter((span) => span.label === label).reduce((sum, span) => sum + approximateUnits(span.text), 0);
  const firstInCharacter = spans.find((span) => span.label === "IN_CHARACTER_REASONING");
  const leakage = /(?:PERSONA_LOAD|系统提示|system prompt|根据设定|角色设定|编码里|prompt里|你给的标签)/i.test(content);
  return {
    metrics: {
      pal_heuristic: reasoning ? approximateUnits(reasoning.slice(0, firstInCharacter?.start ?? reasoning.length)) : null,
      mrr_lexical: total ? unitsFor("META_PROMPT_INTERPRETATION") / total : null,
      icrr_heuristic: total ? unitsFor("IN_CHARACTER_REASONING") / total : null,
      dpe_heuristic: spans.length ? spans[0].label === "IN_CHARACTER_REASONING" : null,
      persona_leakage_lexical: leakage,
      reasoning_units: total,
    },
    spans,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
