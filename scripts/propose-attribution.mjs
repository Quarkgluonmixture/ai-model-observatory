// Proposes an alias for a published model string, or refuses and says why.
//
//   node scripts/propose-attribution.mjs            # report
//   node scripts/propose-attribution.mjs --write    # apply the proposals to data/model-aliases.json
//   node scripts/propose-attribution.mjs --quiet    # only the marker lines, for a workflow to read
//
// This is the step that used to be a person, and it is the most dangerous step in the project: a
// wrong alias reports one model's score under another's name and NOTHING catches it. So the
// question this file answers is not "which model is this probably" — it is "is there evidence that
// settles it". When there is not, it refuses, and refusing costs nothing: the row stays in the
// archive and attaches itself the day an alias exists.
//
// Two tiers, measured against the 247 decisions a human had already made before this existed:
//
//   tier 1  the string, after stripping a CLOSED list of effort tokens, is exactly a catalog
//           family — 144 of 240 reproduced, 0 contradicted.
//   tier 2  the string's scores corroborate a family on at least two like-for-like cells, or one
//           agreeing to within 0.2% — +13, 0 contradicted.
//
// Everything else escalates. That is 35% of the historical set and it is the correct outcome:
// those are strings like `qwen-qwen3-7-max`, where a board doubles a maker prefix for one family
// and not the next, and no rule short of reading the page settles it.
//
// Four refusals are deterministic and exist because the measurement found them:
//
//   - a bare string whose SAME SOURCE also publishes a suffixed sibling. That source is saying
//     they are two models — the reasoning of the one-source-one-cell gate. This is the DeepSeek
//     V4 Flash case, where `deepseek-v4-flash` is the preview on three boards and the 0731
//     release on a fourth, and one global alias put a 49.25 where the real model scores 100.
//   - a version number that does not appear in the string. Without it, "gpt" alone made GPT-5.5 a
//     candidate for GPT-5.6 Sol: one generation splits into Sol, Terra and Luna, and a successor
//     scoring near its predecessor is the normal case, not evidence.
//   - a string published only inside another maker's release table. Those are competitor columns:
//     a maker publishing a rival's score states no harness, effort or date.
//   - a string whose every row is superseded by a later batch.
//
// The `intelligence`-style judgement calls — is this worth cataloguing, what colour, what tags —
// are not here. This file only answers "which model is this string".

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS } from "../app/model-data.ts";
import { ALIAS_FILE, SOURCE_DIR, loadAliasConfig } from "./lib/archive.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const write = args.includes("--write");
const quiet = args.includes("--quiet");
const say = (line = "") => { if (!quiet) console.log(line); };

const config = loadAliasConfig();
const norm = (s) => String(s).toLowerCase().replace(/[\s._\-()]/g, "");

// A CLOSED list. Everything else — pro, lite, mini, nano, flash, plus, preview, codex, a date —
// is a model distinction, not an operating point. `Muse Spark` is not `Muse Spark 1.1`,
// `GPT-5.5 Pro` is not `GPT-5.5`, `gemini-3.5-flash-lite-high` is Flash-Lite and not Flash.
const EFFORTS = [
  "max effort", "xhigh effort", "high effort", "medium effort", "low effort", "minimal effort",
  "max", "xhigh", "x-high", "high", "medium", "low", "minimal", "thinking", "non-thinking",
  "reasoning", "non-reasoning", "adaptive reasoning", "effort", "thinking-auto", "auto",
];

/** Strips effort tokens, or returns null when the string carries two operating dimensions at once. */
const stripEffort = (raw) => {
  let s = String(raw).trim();
  const paren = s.match(/\(([^)]*)\)\s*$/);
  if (paren) {
    const parts = paren[1].split(",").map((p) => p.trim().toLowerCase());
    const hasMode = parts.some((p) => p === "reasoning" || p === "non-reasoning" || p === "non-thinking");
    const hasLevel = parts.some((p) => /(max|xhigh|x-high|high|medium|low|minimal)/.test(p));
    // "(Non-reasoning, High Effort)" is a mode AND a level. Mapping it put two operating modes in
    // one cell, which the one-source-one-cell gate caught the day it was written.
    if (!parts.every((p) => EFFORTS.includes(p)) || (hasMode && hasLevel)) return null;
    s = s.slice(0, paren.index).trim();
  }
  for (let changed = true; changed;) {
    changed = false;
    const bracket = s.match(/\[([^\]]+)\]\s*$/);
    if (bracket && EFFORTS.includes(bracket[1].toLowerCase())) { s = s.slice(0, bracket.index).trim(); changed = true; continue; }
    for (const token of [...EFFORTS].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`[-_. ]${token.replace(/-/g, "[- ]")}(?:[-_. ]effort)?$`, "i");
      if (re.test(s)) { s = s.replace(re, "").trim(); changed = true; break; }
    }
  }
  return s;
};

// ---------------------------------------------------------------- the archive, read once
const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".jsonl"));
const meta = (file) => JSON.parse(readFileSync(join(SOURCE_DIR, file.replace(/\.jsonl$/, ".meta.json")), "utf8"));

const stringsPerFile = new Map();       // file -> Set(model_raw)
const rowsByString = new Map();         // model_raw -> [{cell, score, src, file}]
const filesByString = new Map();        // model_raw -> Set(file)

for (const file of files) {
  const seen = new Set();
  for (const line of readFileSync(join(SOURCE_DIR, file), "utf8").trim().split("\n")) {
    if (!line) continue;
    const row = JSON.parse(line);
    seen.add(row.model_raw);
    if (!filesByString.has(row.model_raw)) filesByString.set(row.model_raw, new Set());
    filesByString.get(row.model_raw).add(file);
    if (row.benchmark === undefined || row.score === undefined) continue;   // a parameter batch
    // Like for like: a cell may legitimately hold several rows (harness, effort, tools), so two
    // scores are only comparable when all of that matches. Comparing across harnesses made a
    // model's own rows look like a contradiction and knocked the right answer out of the running.
    const cell = `${row.benchmark}|${row.benchmark_version}|${row.harness ?? ""}|${row.reasoning_effort ?? ""}`;
    if (!rowsByString.has(row.model_raw)) rowsByString.set(row.model_raw, []);
    rowsByString.get(row.model_raw).push({ cell, score: row.score, src: row.source_label, file });
  }
  stringsPerFile.set(file, seen);
}

// Strings a human has already ruled on — globally, per file, or by refusing. Never re-proposed.
const decided = new Set(config.aliases.map((a) => a.modelRaw));
const globalMap = new Map(config.aliases.filter((a) => a.modelId && !a.file).map((a) => [a.modelRaw, a.modelId]));

const rowsByModel = new Map();
for (const [raw, rows] of rowsByString) {
  const id = globalMap.get(raw);
  if (!id) continue;
  if (!rowsByModel.has(id)) rowsByModel.set(id, []);
  rowsByModel.get(id).push(...rows);
}

// A maker's release capture, identified by HOW it was collected. `meta.release` is not the test:
// LiveBench's batches carry a `release` too and it means the question set's publication date, so
// keying on it filed 23-row LiveBench strings as competitor columns.
const releaseBatches = new Set(files.filter((f) => {
  try { return String(meta(f).collectedWith ?? "").includes("capture-release-tables"); } catch { return false; }
}));

// Superseded is recorded per (file, benchmark), not per file: batch 02 was superseded for deepswe
// and terminal, not wholesale. A file-level test let a superseded eye-read through as tier 2.
const supersededCells = new Set();
for (const entry of config.supersededRows ?? []) supersededCells.add(`${entry.file}|${entry.benchmark ?? "*"}`);
const isSuperseded = (row) => {
  const file = row.file.replace(/\.jsonl$/, "");
  const benchmark = row.cell.split("|")[0];
  return supersededCells.has(`${file}|${benchmark}`) || supersededCells.has(`${file}|*`);
};

// Bases a human has already declared ambiguous by scoping an alias to one file. Every effort
// variant of such a base inherits the ambiguity — `deepseek-v4-flash-thinking` strips to the one
// string in this archive that means two different models depending on the board.
const scopedBases = new Set(config.aliases.filter((a) => a.file).map((a) => norm(a.modelRaw)));

// ---------------------------------------------------------------- the two tiers
const families = MODELS.map((model) => ({ id: model.id, name: model.name }));

const siblingInSameSource = (raw, base) => {
  for (const file of filesByString.get(raw) ?? []) {
    for (const other of stringsPerFile.get(file)) {
      if (other === raw) continue;
      const otherBase = norm(stripEffort(other) ?? other);
      if (otherBase !== base && otherBase.startsWith(base)) return { other, file };
    }
  }
  return null;
};

const tier1 = (raw) => {
  // Unstripped FIRST. "max" is an effort for Anthropic and OpenAI and a product tier for Alibaba,
  // so stripping before matching turned `qwen-3-8-max` into `qwen-3-8` and lost the family whose
  // id ends in the same word. Whichever form matches the catalog exactly is the right reading.
  const direct = families.filter((f) => norm(f.id) === norm(raw) || norm(f.name) === norm(raw));
  if (direct.length === 1) {
    const sibling = siblingInSameSource(raw, norm(raw));
    if (sibling) return { verdict: "escalate", why: `${sibling.file} publishes both this and "${sibling.other}"` };
    return { verdict: "map", modelId: direct[0].id, tier: 1, evidence: `the published string is exactly ${direct[0].id}` };
  }
  const base = stripEffort(raw);
  if (base === null) return { verdict: "escalate", why: "two operating dimensions in one string" };
  const key = norm(base);
  if (!key) return { verdict: "escalate", why: "nothing left after stripping the effort" };
  const hits = families.filter((f) => norm(f.id) === key || norm(f.name) === key);
  if (hits.length > 1) return { verdict: "escalate", why: `matches ${hits.length} catalog families` };
  if (hits.length === 0) return null;                       // not a tier-1 case; try tier 2
  const sibling = siblingInSameSource(raw, key);
  if (sibling) {
    return { verdict: "escalate", why: `${sibling.file} publishes both this and "${sibling.other}" — one source publishing two strings is that source saying they are two models` };
  }
  return { verdict: "map", modelId: hits[0].id, tier: 1, evidence: `"${base}" is exactly ${hits[0].id} after stripping the effort` };
};

const TIGHT = 0.01, EXACT = 0.002, CONFLICT = 0.05;
const tier2 = (raw) => {
  const mine = rowsByString.get(raw) ?? [];
  if (!mine.length) return { verdict: "escalate", why: "no scores to corroborate with" };
  const scored = [];
  for (const [id, theirs] of rowsByModel) {
    const words = id.split(/[.\-]/).filter((t) => t.length > 2 && !/^[0-9.]+$/.test(t));
    const version = (id.match(/[0-9]+(?:\.[0-9]+)?/) ?? [""])[0].replace(".", "");
    if (!words.some((w) => norm(raw).includes(norm(w)))) continue;
    if (version && !norm(raw).includes(version)) continue;   // the generation-split guard
    // Nothing may be left over. `gpt-5.5-pro-pre-release` scores within 0.2% of GPT-5.5 on a
    // cell and is neither GPT-5.5 nor a configuration of it: Pro is a different model and a
    // pre-release is a different model again. A residual token is a model distinction until a
    // reader says otherwise, which is the whole content of the attribution rule.
    const residual = norm(stripEffort(raw) ?? raw).replace(norm(id), "").replace(/^(the)?/, "");
    if (residual.length) continue;
    let agree = 0, exact = 0, conflict = 0;
    for (const a of mine) for (const b of theirs) {
      if (a.cell !== b.cell || a.src === b.src) continue;
      const rel = Math.abs(a.score - b.score) / Math.max(1e-9, Math.abs(b.score));
      if (rel <= TIGHT) { agree++; if (rel <= EXACT) exact++; } else if (rel > CONFLICT) conflict++;
    }
    if (agree || conflict) scored.push({ id, agree, exact, conflict });
  }
  const clean = scored.filter((s) => s.conflict === 0 && (s.agree >= 2 || s.exact >= 1));
  if (clean.length > 1) return { verdict: "escalate", why: `${clean.length} families corroborate — ambiguous` };
  if (clean.length === 1) {
    return { verdict: "map", modelId: clean[0].id, tier: 2, evidence: `${clean[0].agree} like-for-like cell(s) agree within 1%${clean[0].exact ? `, ${clean[0].exact} within 0.2%` : ""}, none conflict` };
  }
  return { verdict: "escalate", why: scored.length ? "candidates conflict on a shared cell" : "no like-for-like cell shared with any family" };
};

const judge = (raw) => {
  const onlyRelease = [...(filesByString.get(raw) ?? [])].every((f) => releaseBatches.has(f));
  if (onlyRelease) return { verdict: "escalate", why: "published only inside a maker's release table — a competitor column states no harness, effort or date" };
  const rows = rowsByString.get(raw) ?? [];
  if (rows.length && rows.every(isSuperseded)) {
    return { verdict: "escalate", why: "every row is superseded by a later batch — the newer reading is already ingested under its own string" };
  }
  const base = stripEffort(raw);
  if (base !== null && scopedBases.has(norm(base))) {
    return { verdict: "escalate", why: `"${base}" carries a file-scoped alias, which is a human saying it means different models on different boards — every effort variant of it inherits that` };
  }
  return tier1(raw) ?? tier2(raw);
};

// ---------------------------------------------------------------- backtest
// The gate is only trustworthy to the extent it agrees with the decisions a human already made,
// so those decisions are the test set and this replays them. It runs in CI: a rule change that
// starts contradicting a human, or that starts mapping a string somebody deliberately refused,
// fails the build rather than shipping quietly.
//
// Every entry below is documented in data/model-aliases.json's `_doc` as deliberately unmapped,
// with the reason. They are the cases where a plausible rule gets it wrong.
const TRAPS = [
  "Gemini 3.5 Flash-Lite", "gemini-3.5-flash-lite-high", "Claude Sonnet 5 (Non-reasoning, High Effort)",
  "Muse Spark", "GPT-5.5 Pro", "GPT-5.2 Pro", "GPT-5.4 Pro", "DeepSeek v4 (max)",
  "GPT 5.6 Sol (Max + Pro)", "Fable 5 (1M)", "qwen3.6-27b", "gpt-5.2-codex", "claude-opus-4.7",
  "gpt-5.4-mini-xhigh", "Gemini 3 Pro", "gpt-5.6", "GPT-5.6", "gpt-5.6-luna-pro",
  "gpt-5.5-pre-release", "gpt-5.5-pro-pre-release", "deepseek-v4-flash",
];

if (args.includes("--backtest")) {
  const humanCalls = config.aliases.filter((a) => a.modelId && !a.file);
  let reproduced = 0, escalated = 0; const contradicted = [];
  for (const call of humanCalls) {
    // Fair test: the string under test cannot corroborate itself.
    const own = rowsByModel.get(call.modelId) ?? [];
    rowsByModel.set(call.modelId, own.filter((r) => !(rowsByString.get(call.modelRaw) ?? []).includes(r)));
    const verdict = judge(call.modelRaw);
    rowsByModel.set(call.modelId, own);
    if (verdict.verdict === "map" && verdict.modelId === call.modelId) reproduced++;
    else if (verdict.verdict === "map") contradicted.push(`${call.modelRaw}: gate ${verdict.modelId}, human ${call.modelId}`);
    else escalated++;
  }
  const falsePositives = [];
  for (const trap of TRAPS) {
    if (globalMap.has(trap)) continue;                      // a human mapped it after all
    const verdict = judge(trap);
    if (verdict.verdict === "map") falsePositives.push(`${trap} → ${verdict.modelId} (${verdict.evidence})`);
  }
  const pct = ((reproduced / humanCalls.length) * 100).toFixed(0);
  console.log(`Backtest against ${humanCalls.length} human decisions: ${reproduced} reproduced (${pct}%), ${escalated} escalated, ${contradicted.length} contradicted.`);
  for (const line of contradicted) console.log(`  CONTRADICTED ${line}`);
  console.log(`Trap set: ${TRAPS.length} strings a human deliberately left unmapped, ${falsePositives.length} mapped by the gate.`);
  for (const line of falsePositives) console.log(`  FALSE POSITIVE ${line}`);
  if (contradicted.length || falsePositives.length) process.exit(1);
  process.exit(0);
}

// ---------------------------------------------------------------- report
const proposals = [], escalations = [];
for (const raw of rowsByString.keys()) {
  if (decided.has(raw)) continue;
  const result = judge(raw);
  if (result.verdict === "map") proposals.push({ raw, ...result });
  else escalations.push({ raw, why: result.why, rows: rowsByString.get(raw).length });
}

// Closed under the checker's own equivalence. `check:models` fails when an unmapped string
// differs from an alias only in casing, spaces or hyphens — because alias resolution is exact and
// such a row is dropped in silence. Proposing one spelling and not its siblings manufactures
// exactly that failure, which is what the gate's first live run did: it mapped `GPT 5.5 (high)`
// and left `GPT-5.5 (High)` and `GPT-5.5 (high)` behind.
const proposedKeys = new Map(proposals.map((p) => [norm(p.raw), p]));
for (const raw of rowsByString.keys()) {
  if (decided.has(raw) || proposedKeys.get(norm(raw))?.raw === raw) continue;
  const twin = proposedKeys.get(norm(raw));
  if (!twin) continue;
  proposals.push({ raw, modelId: twin.modelId, tier: twin.tier, evidence: `the same published string as "${twin.raw}" up to casing and separators, which alias resolution treats as different` });
  const index = escalations.findIndex((e) => e.raw === raw);
  if (index >= 0) escalations.splice(index, 1);
}

proposals.sort((a, b) => a.tier - b.tier || a.raw.localeCompare(b.raw));
escalations.sort((a, b) => b.rows - a.rows);

if (proposals.length) {
  say(`## Attribution proposed for ${proposals.length} published string(s)\n`);
  for (const p of proposals) say(`- \`${p.raw}\` → **${p.modelId}** (tier ${p.tier}) — ${p.evidence}`);
  say("");
}
say(`${escalations.length} string(s) need a reader. The top ones by row count:\n`);
for (const e of escalations.slice(0, 15)) say(`- \`${e.raw}\` (${e.rows} rows) — ${e.why}`);
say("");
say("A refusal costs nothing: the row stays archived and attaches the day an alias exists.");

if (write && proposals.length) {
  const next = loadAliasConfig();
  for (const p of proposals) {
    next.aliases.push({
      modelRaw: p.raw,
      effort: "*",
      modelId: p.modelId,
      reason: `Proposed by scripts/propose-attribution.mjs, tier ${p.tier}: ${p.evidence}. No human read this string; the contract is what accepted it.`,
    });
  }
  writeFileSync(join(ROOT, ALIAS_FILE.replace(ROOT, "")), `${JSON.stringify(next, null, 2)}\n`);
  say(`\nWrote ${proposals.length} alias entr(ies). Run: npm run ingest && the full contract.`);
}

console.log(`<!-- attribution-proposed: ${proposals.length} -->`);
console.log(`<!-- attribution-escalated: ${escalations.length} -->`);
