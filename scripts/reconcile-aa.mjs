// Copies a re-measured AA speed or latency into the catalog record that quotes it, and refuses
// every other kind of disagreement.
//
//   node scripts/reconcile-aa.mjs            # say what it would do, change nothing
//   node scripts/reconcile-aa.mjs --write    # do it
//   node scripts/reconcile-aa.mjs --self-test
//
// ## Why this exists
//
// Artificial Analysis re-measures speed and latency continuously. `aa-refresh.yml` re-reads the
// batch, `check:models` then finds the catalog quoting yesterday's number, and the pull request
// cannot merge until somebody edits `app/model-data.ts` by hand. That edit has now been made
// twice by a person, and both times it was the same edit:
//
//   - PR #114 (2026-09-01) — 14 contradictions, catalog set to the archive value.
//   - PR #121 (2026-09-04) — 20 contradictions, all speed/latency, catalog set to the archive
//     value; the commit message's whole argument was "the archive side carries provenance from a
//     scripted re-read this morning, so the catalog is the stale side".
//
// That argument is not a judgement. It is true by construction for these two fields: the archive
// row was written by a script minutes earlier from the source that publishes the number, and the
// catalog value is a copy of an older run of the same script. There is no third possibility to
// weigh. So it is written down here instead of being re-argued every week.
//
// ## What it will not touch, and why the line is where it is
//
// Only `speed` and `latency`. `TODO.md` already records why those two are different from
// everything else beside them: they are AA's live attributes, they wobble in both directions, and
// the catalog follows the newest reading because there is nothing else it could sensibly follow.
//
// `intelligence` and `costTask` come from the same batch and are deliberately NOT here. They are
// composites that rank the board — intelligence drives the ordering readers see — and when they
// moved in bulk on 2026-08-12 the fix was a routing decision (`supersededRows`, per model and per
// field) that somebody had to make once and write down. A script that quietly followed them would
// re-rank the site with nobody having decided to.
//
// `price`, `open`, `textElo`, `codeElo` are not AA's to re-measure at all; a contradiction there
// means something else is wrong and must reach a person.
//
// ## Fail-closed, and all-or-nothing
//
// If ANY contradiction is outside the two fields, this writes nothing at all — not even the ones
// it could have handled. Two reasons, and the second is the load-bearing one:
//
//   1. A mixed diff is the shape that costs a reviewer the most: they open a pull request whose
//      title says "reconcile", and have to work out which of the twenty lines is the one somebody
//      still owes a decision on.
//   2. The contract will be red either way — an unreconciled intelligence contradiction fails
//      `check:models` on its own — so the pull request stays open for a person regardless. Writing
//      the mechanical half buys nothing and hides the half that matters.
//
// It also refuses to act when `check:models` reports a spelling orphan or a product-tier mismap.
// Those mean the archive is being read wrong, so every value under them is suspect, and a
// confident wrong number is the one failure mode this whole repository is built to avoid.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CATALOG = `${ROOT}app/model-data.ts`;

// The `cfg(...)` positional signature, from app/model-data.ts. Index, not name, because that is
// what a source rewrite needs — and it is asserted against the real file by --self-test, so a
// reordering of `cfg`'s parameters fails here rather than silently writing latency into speed.
const CFG_ARG = { effort: 0, intelligence: 1, costTask: 2, speed: 3, latency: 4 };
const RECONCILABLE = new Set(["speed", "latency"]);

// Split a `cfg(...)` argument list on top-level commas. The arguments are literals — a quoted
// string, a number, `null`, `true`/`false` — so tracking quotes is enough; there are no nested
// calls or arrays to balance. Asserted by --self-test rather than assumed.
const splitArgs = (inner) => {
  const args = [];
  let current = "";
  let quoted = false;
  for (const ch of inner) {
    if (ch === '"') quoted = !quoted;
    if (ch === "," && !quoted) {
      args.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  args.push(current);
  return args;
};

const effortOf = (arg) => {
  const value = arg.trim();
  if (value === "null") return null;
  const quoted = /^"([^"]*)"$/.exec(value);
  return quoted ? quoted[1] : undefined;
};

/**
 * Applies one reconciliation to the catalog source text. Pure, so --self-test can exercise every
 * refusal without a repository.
 *
 * Returns `{ text, before }` on success. Throws on anything ambiguous — a model whose block is not
 * found, an effort that matches no `cfg` line or more than one, or a current value that is not the
 * one `check:models` said it saw. That last one is the guard that matters: it means the audit and
 * this writer are looking at different things, and the correct response to that is to stop.
 */
export const rewriteSlot = (text, { modelId, effort, field, catalogValue, archiveValue }) => {
  // The allowlist is enforced here, in the writer, and not only where the contradictions are
  // partitioned. `CFG_ARG` has to carry `intelligence` and `costTask` so the signature check below
  // can assert their positions — which means a caller that passed one of them would otherwise get
  // a clean, confident rewrite of the field this script exists to refuse.
  if (!RECONCILABLE.has(field)) throw new Error(`${field} is not a field this may write`);
  const argIndex = CFG_ARG[field];
  if (argIndex == null) throw new Error(`${field} is not a cfg() argument`);

  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trimStart().startsWith(`m("${modelId}",`));
  if (start === -1) throw new Error(`no m("${modelId}", …) record in app/model-data.ts`);
  // The record ends at its closing `]),` — the only line in the block at the same indentation as
  // the `m(` that opened it. Scanning to the next `m(` instead would swallow the comment lines
  // that sit between records, and those comments are where this file keeps its reasoning.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*\]\),\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const matches = [];
  for (let i = start; i < end; i += 1) {
    const cfg = /^(\s*cfg\()(.*)(\),\s*)$/.exec(lines[i]);
    if (!cfg) continue;
    const args = splitArgs(cfg[2]);
    if (effortOf(args[CFG_ARG.effort]) !== effort) continue;
    matches.push({ line: i, prefix: cfg[1], args, suffix: cfg[3] });
  }
  const label = `${modelId} (${effort ?? "default"}) ${field}`;
  if (matches.length === 0) throw new Error(`${label}: no cfg() line with that effort`);
  if (matches.length > 1) throw new Error(`${label}: ${matches.length} cfg() lines share that effort`);

  const [match] = matches;
  const before = Number(match.args[argIndex]);
  // 0.005 is the audit's own tolerance (`close` in check-model-provenance.mjs). Matching it means
  // this refuses exactly when the audit would not have flagged the slot in the first place.
  if (!Number.isFinite(before) || Math.abs(before - catalogValue) >= 0.005) {
    throw new Error(`${label}: file says ${match.args[argIndex].trim()}, audit saw ${catalogValue}`);
  }

  // Rewrite the one argument and keep everything else byte-for-byte, including the leading space
  // each argument carries after the comma. A reformat here would show up as a whole-line diff and
  // bury the number that actually moved.
  const args = [...match.args];
  const spacing = /^(\s*)/.exec(args[argIndex])[1];
  args[argIndex] = `${spacing}${archiveValue}`;
  lines[match.line] = `${match.prefix}${args.join(",")}${match.suffix}`;
  return { text: lines.join("\n"), before, label };
};

/** Folds every reconciliation over the text and hands back the rewritten source. */
export const applyAll = (text, slots) => {
  let out = text;
  const applied = [];
  for (const slot of slots) {
    const { text: next, before, label } = rewriteSlot(out, slot);
    out = next;
    applied.push({ ...slot, before, label });
  }
  return { text: out, applied };
};

// ---------------------------------------------------------------------------------------------

const selfTest = () => {
  const failures = [];
  const expect = (name, run) => {
    try {
      run();
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    }
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  const fixture = [
    `  m("gpt-5.6-sol", "GPT-5.6 Sol", "OpenAI", "#bf8b18", false, 1000, ["reasoning"], [`,
    `    cfg("max", 60.9, 0.953, 70.29, 112.71, 5, 30, false, 0.5),`,
    `    cfg("high", 57.3, 0.4269, 78.01, 9.92, 5, 30, false, 0.5),`,
    `  ]),`,
    `  // a comment between records`,
    `  m("qwen3.8-max", "Qwen3.8 Max", "Alibaba", "#1c5f6e", false, 1000, ["coding"], [`,
    `    cfg(null, 58.1, 0.9133, 40.54, 2.53, 2, 6, false, 0.17),`,
    `  ]),`,
  ].join("\n");

  expect("writes speed into the right effort's line", () => {
    const { text, applied } = applyAll(fixture, [
      { modelId: "gpt-5.6-sol", effort: "max", field: "speed", catalogValue: 70.29, archiveValue: 76.54 },
    ]);
    assert(text.includes(`cfg("max", 60.9, 0.953, 76.54, 112.71, 5, 30, false, 0.5),`), "max line not rewritten");
    assert(text.includes(`cfg("high", 57.3, 0.4269, 78.01, 9.92, 5, 30, false, 0.5),`), "high line was touched");
    assert(applied[0].before === 70.29, "did not report the previous value");
  });

  expect("writes latency, and two slots on one line compose", () => {
    const { text } = applyAll(fixture, [
      { modelId: "gpt-5.6-sol", effort: "max", field: "speed", catalogValue: 70.29, archiveValue: 76.54 },
      { modelId: "gpt-5.6-sol", effort: "max", field: "latency", catalogValue: 112.71, archiveValue: 98.87 },
    ]);
    assert(text.includes(`cfg("max", 60.9, 0.953, 76.54, 98.87, 5, 30, false, 0.5),`), "second slot lost the first");
  });

  expect("a null effort is a real effort, not a wildcard", () => {
    const { text } = applyAll(fixture, [
      { modelId: "qwen3.8-max", effort: null, field: "latency", catalogValue: 2.53, archiveValue: 2.5 },
    ]);
    assert(text.includes(`cfg(null, 58.1, 0.9133, 40.54, 2.5, 2, 6, false, 0.17),`), "null-effort line not rewritten");
  });

  expect("refuses when the file disagrees with the audit", () => {
    let threw = false;
    try {
      applyAll(fixture, [
        { modelId: "gpt-5.6-sol", effort: "max", field: "speed", catalogValue: 999, archiveValue: 1 },
      ]);
    } catch {
      threw = true;
    }
    assert(threw, "rewrote a value the audit had not seen");
  });

  expect("refuses a field outside the two", () => {
    let threw = false;
    try {
      applyAll(fixture, [
        { modelId: "gpt-5.6-sol", effort: "max", field: "intelligence", catalogValue: 60.9, archiveValue: 61 },
      ]);
    } catch {
      threw = true;
    }
    assert(threw, "rewrote intelligence");
  });

  expect("refuses an unknown model rather than writing nowhere", () => {
    let threw = false;
    try {
      applyAll(fixture, [
        { modelId: "not-a-model", effort: null, field: "speed", catalogValue: 1, archiveValue: 2 },
      ]);
    } catch {
      threw = true;
    }
    assert(threw, "silently did nothing for a model it could not find");
  });

  // The positional map is the one thing here that a change elsewhere can invalidate silently, so
  // it is checked against the real declaration rather than against the fixture.
  expect("cfg()'s real signature still matches CFG_ARG", () => {
    const source = readFileSync(CATALOG, "utf8");
    const declaration = /const cfg = \(([\s\S]*?)\): ModelConfiguration/.exec(source);
    assert(declaration, "could not find cfg()'s declaration in app/model-data.ts");
    const names = declaration[1]
      .split("\n")
      .map((line) => /^\s*(\w+)\s*[:=]/.exec(line))
      .filter(Boolean)
      .map((match) => match[1]);
    for (const [field, index] of Object.entries(CFG_ARG)) {
      assert(names[index] === field, `cfg() argument ${index} is "${names[index]}", not "${field}"`);
    }
  });

  if (failures.length) {
    console.error(`reconcile-aa self-test FAILED (${failures.length}):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log("reconcile-aa self-test passed: 7 checks.");
};

// ---------------------------------------------------------------------------------------------

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const write = process.argv.includes("--write");

  const audit = JSON.parse(
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", `${ROOT}scripts/check-model-provenance.mjs`, "--json"],
      { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 },
    ),
  );

  const blockers = [...audit.blockers.caseErrors, ...audit.blockers.variantErrors];
  const escalate = audit.contradictions.filter((entry) => !RECONCILABLE.has(entry.field));
  const mechanical = audit.contradictions.filter((entry) => RECONCILABLE.has(entry.field));

  const report = [];
  let reconciled = 0;

  if (blockers.length) {
    report.push(
      `**Not reconciled.** \`check:models\` reports ${blockers.length} alias problem(s), which means the`,
      "archive is being read wrong. Every value under that is suspect, so nothing was written:",
      "",
      ...blockers.map((entry) => `- ${entry}`),
    );
  } else if (escalate.length) {
    report.push(
      `**Not reconciled.** ${escalate.length} of ${audit.contradictions.length} contradiction(s) are outside`,
      "`speed` / `latency`, and those are somebody's decision, not a re-measure. Nothing was written —",
      "not even the mechanical ones, so this diff stays about one question:",
      "",
      ...escalate.map((entry) => `- \`${entry.field}\` — ${entry.label}: catalog ${entry.catalogValue}, archive ${entry.archiveValue}`),
    );
  } else if (!mechanical.length) {
    report.push("The catalog already quotes the archive's speed and latency. Nothing to reconcile.");
  } else {
    const source = readFileSync(CATALOG, "utf8");
    const { text, applied } = applyAll(source, mechanical);
    if (write) writeFileSync(CATALOG, text);
    reconciled = applied.length;
    report.push(
      `${write ? "Reconciled" : "Would reconcile"} ${applied.length} operating-parameter value(s) to the re-measured AA archive.`,
      "AA re-measures these continuously and the archive row was written by a script from the source,",
      "so the catalog is the stale side by construction — see this script's header.",
      "",
      "| model | effort | field | catalog | archive |",
      "| --- | --- | --- | ---: | ---: |",
      ...applied.map(
        (entry) =>
          `| \`${entry.modelId}\` | ${entry.effort ?? "default"} | ${entry.field} | ${entry.before} | ${entry.archiveValue} |`,
      ),
    );
  }

  console.log(report.join("\n"));
  console.log(`\n<!-- aa-reconciled: ${reconciled} -->`);
  console.log(`<!-- aa-escalated: ${escalate.length + blockers.length} -->`);
}
