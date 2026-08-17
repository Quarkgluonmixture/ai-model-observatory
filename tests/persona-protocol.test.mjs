import assert from "node:assert/strict";
import test from "node:test";

import {
  activationMetrics,
  normalizeCompilerOutput,
  validateCompilerOutput,
} from "../app/persona/protocol.ts";

function compilerOutput() {
  return {
    extraction: {
      facts: [
        {
          fact_id: "F001",
          certainty: "explicit",
          source_quote: "聪明温柔的小猫",
          atoms: ["IDENTITY_TALKING_CAT", "PERSONALITY_SMART_GENTLE"],
          critical: true,
        },
      ],
    },
    candidates: [
      {
        candidate_id: "candidate_001",
        profile: "canonical_medium",
        encoding: "【PERSONA_LOAD】\nIDENTITY_TALKING_CAT\nPERSONALITY_SMART_GENTLE",
        covered_fact_ids: ["F001"],
        rationale: "medium",
      },
      {
        candidate_id: "candidate_002",
        profile: "compact_gestalt",
        encoding: "【PERSONA_LOAD】\nIDENTITY_SMART_GENTLE_CAT",
        covered_fact_ids: ["F001"],
        rationale: "compact",
      },
    ],
  };
}

test("accepts valid medium and compact compiler candidates", () => {
  const result = validateCompilerOutput(compilerOutput(), 2);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.candidates[0].tag_count, 2);
  assert.equal(result.candidates[1].explicit_fact_coverage, 1);
});

test("rejects a candidate that drops the wrapper", () => {
  const output = compilerOutput();
  output.candidates[0].encoding = "IDENTITY_TALKING_CAT";
  const result = validateCompilerOutput(output, 2);
  assert.equal(result.valid, false);
  assert.match(result.candidates[0].errors.join("\n"), /首行必须是/);
});

test("normalizes mixed-case semantic tags without changing the raw object", () => {
  const output = compilerOutput();
  output.extraction.facts[0].atoms[0] = "IDENTITY_NAME_Butch";
  output.candidates[0].encoding = "【PERSONA_LOAD】\nIDENTITY_NAME_Butch\nPERSONALITY_SMART_GENTLE";
  const normalized = normalizeCompilerOutput(output);

  assert.equal(output.extraction.facts[0].atoms[0], "IDENTITY_NAME_Butch");
  assert.equal(normalized.value.extraction.facts[0].atoms[0], "IDENTITY_NAME_BUTCH");
  assert.match(normalized.value.candidates[0].encoding, /IDENTITY_NAME_BUTCH/);
  assert.deepEqual(normalized.normalizations, ["uppercased 2 semantic tag value(s)"]);
  assert.equal(validateCompilerOutput(normalized.value, 2).valid, true);
});

test("activation metrics keep meta and in-character spans separate", () => {
  const mixed = activationMetrics("用户要求我扮演角色。主人怎么还没睡？", "主人还没睡吗？");
  assert.equal(mixed.metrics.dpe_heuristic, false);
  assert.ok((mixed.metrics.pal_heuristic ?? 0) > 0);
  assert.ok((mixed.metrics.mrr_lexical ?? 0) > 0);
  assert.ok((mixed.metrics.icrr_heuristic ?? 0) > 0);

  const direct = activationMetrics("主人怎么还没睡？", "主人还没睡吗？");
  assert.equal(direct.metrics.dpe_heuristic, true);
  assert.equal(direct.metrics.pal_heuristic, 0);
});
