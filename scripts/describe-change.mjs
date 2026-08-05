// Says what a change does to the published board, in the language of the board.
//
//   node scripts/describe-change.mjs            # working tree against HEAD
//   node scripts/describe-change.mjs <ref>      # working tree against another commit
//
// The reviewer this exists for cannot check an alias mapping — nobody can eyeball whether
// `qwen-qwen3-7-max` belongs to Qwen3.7 Max — but they can absolutely tell you whether Qwen3.8 Max
// scoring 92.6 on GPQA looks right, and they will notice immediately if a model they know
// suddenly moved twenty points. So a pull request that asks for the first kind of judgement gets
// rubber-stamped, and one that asks for the second gets read.
//
// It reads the generated observation store, which is the file that decides what the site shows.
// Not the archive: an archived row that never resolves changes nothing a reader will ever see.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BENCHMARKS, MODELS } from "../app/model-data.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const STORE = "app/observations.generated.ts";
const baseRef = process.argv[2] ?? "HEAD";

const modelName = new Map(MODELS.map((model) => [model.id, model.name]));
const benchmarkName = new Map(BENCHMARKS.map((benchmark) => [benchmark.id, benchmark.name]));

// One row per line in the generated file, so a line-wise regex is exact rather than hopeful.
const ROW = /modelId: "([^"]+)", benchmarkId: "([^"]+)", score: ([-\d.]+)[\s\S]*?sourceLabel: "([^"]*)"[\s\S]*?sourceKind: "([^"]+)"[\s\S]*?harness: (null|"[^"]*")[\s\S]*?reasoningEffort: (null|"[^"]*")/;

const parse = (text) => {
  const rows = new Map();
  for (const line of text.split("\n")) {
    const match = ROW.exec(line);
    if (!match) continue;
    const [, modelId, benchmarkId, score, sourceLabel, sourceKind, harness, effort] = match;
    const key = `${modelId}|${benchmarkId}|${harness}|${effort}`;
    rows.set(key, { modelId, benchmarkId, score: Number(score), sourceLabel, sourceKind });
  }
  return rows;
};

const before = (() => {
  try {
    return parse(execSync(`git show ${baseRef}:${STORE}`, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    return new Map();
  }
})();
const after = parse(readFileSync(join(ROOT, STORE), "utf8"));

// Source class per cell, not only the score. A cell's displayed number is chosen by source
// precedence — benchmark-native over independent over vendor — so a row changing class can change
// what the site shows without any score moving. That went unreported twice in one day: once when
// an Artificial Analysis refresh moved catalog numbers this report could not see, and once when a
// self-report filed as benchmark-native was corrected to vendor. Both times it said "nothing
// changed", both times it was wrong in the same direction.
const cellsOf = (rows) => {
  const cells = new Map();
  for (const row of rows.values()) {
    const key = `${row.modelId}|${row.benchmarkId}`;
    if (!cells.has(key)) cells.set(key, { ...row, kinds: new Set() });
    cells.get(key).kinds.add(row.sourceKind);
  }
  return cells;
};
const cellsBefore = cellsOf(before);
const cellsAfter = cellsOf(after);

const gained = new Map();
for (const [key, row] of cellsAfter) {
  if (cellsBefore.has(key)) continue;
  (gained.get(row.modelId) ?? gained.set(row.modelId, []).get(row.modelId)).push(row);
}

const lost = new Map();
for (const [key, row] of cellsBefore) {
  if (cellsAfter.has(key)) continue;
  (lost.get(row.modelId) ?? lost.set(row.modelId, []).get(row.modelId)).push(row);
}

// A number that moved in a cell that already existed. This is the line that matters most: a new
// cell is an addition somebody chose, a moved number is the board changing its mind about a model
// that is already on the site.
const moved = [];
const reclassified = [];
for (const [key, row] of cellsAfter) {
  const was = cellsBefore.get(key);
  if (!was) continue;
  if (was.score !== row.score) moved.push({ ...row, was: was.score });
  const before = [...was.kinds].sort().join("+");
  const after = [...row.kinds].sort().join("+");
  if (before !== after) reclassified.push({ ...row, from: before, to: after });
}

// The catalog's own numbers — intelligence, cost, speed, latency, Elo, price — are not
// observations and so are invisible to everything above. That gap mattered the moment this
// report became a merge condition: an Artificial Analysis refresh changes speed and price on
// every model and would have been described as "nothing changed". Read textually from both
// versions of the file, because the base revision is TypeScript that cannot simply be imported.
const CFG_FIELDS = ["effort", "intelligence", "cost/task", "speed", "latency", "text Elo", "code Elo", "$in", "$out"];
const RECORD = /m\("([^"]+)",\s*"([^"]+)"[\s\S]{0,400}?cfg\(([^)]*)\)/g;
const parseCatalog = (text) => {
  const records = new Map();
  for (const [, id, name, argsRaw] of text.matchAll(RECORD)) {
    const args = argsRaw.split(",").map((arg) => arg.trim());
    records.set(id, { name, args });
  }
  return records;
};

const catalogBefore = (() => {
  try {
    return parseCatalog(execSync(`git show ${baseRef}:app/model-data.ts`, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    return new Map();
  }
})();
const catalogAfter = parseCatalog(readFileSync(join(ROOT, "app/model-data.ts"), "utf8"));

const catalogChanges = [];
for (const [id, record] of catalogAfter) {
  const was = catalogBefore.get(id);
  if (!was) { catalogChanges.push(`新增目录记录 **${record.name}**`); continue; }
  for (const [index, field] of CFG_FIELDS.entries()) {
    const before = was.args[index];
    const after = record.args[index];
    if (before === undefined || after === undefined || before === after) continue;
    catalogChanges.push(`${record.name} · ${field}: ${before} → ${after}`);
  }
}
for (const [id, record] of catalogBefore) {
  if (!catalogAfter.has(id)) catalogChanges.push(`⚠ 目录记录被移除 **${record.name}**`);
}

// The hole the other gates cannot see.
//
// The disagreement gate needs two sources to disagree; the one-source-one-cell gate needs one
// board to publish two strings. Neither fires when a single alias puts a single string into a
// column that has only one source — mapping `qwen-qwen3-7-max` to the wrong family would pass
// every check this project has, because nothing exists that could contradict it.
//
// Reported, NOT a merge condition — and the measurement is why. 46 of 68 columns in the generated
// store have a single source, so blocking on this would stop almost every addition, and a check
// that is always red is a check nobody reads. It is printed because knowing "nothing here can
// contradict this number" changes how hard a reader looks at it, which is the point of the whole
// report. The residual control is the reader: a wrong attribution usually produces a score that
// looks wrong for the model it is filed under, and that is a judgement a person can actually make.
const sourcesPerBenchmark = new Map();
for (const row of after.values()) {
  (sourcesPerBenchmark.get(row.benchmarkId) ?? sourcesPerBenchmark.set(row.benchmarkId, new Set()).get(row.benchmarkId))
    .add(row.sourceLabel);
}
const unverifiable = [];
for (const rows of gained.values()) {
  for (const row of rows) {
    if ((sourcesPerBenchmark.get(row.benchmarkId)?.size ?? 0) > 1) continue;
    unverifiable.push(row);
  }
}

const label = (modelId) => modelName.get(modelId) ?? modelId;
const cell = (row) => `${benchmarkName.get(row.benchmarkId) ?? row.benchmarkId} ${row.score}`;
const out = [];

if (gained.size === 0 && lost.size === 0 && moved.length === 0 && catalogChanges.length === 0 && reclassified.length === 0) {
  out.push("这次改动不改变任何已发布的数字。");
} else {
  for (const [modelId, rows] of [...gained].sort((a, b) => b[1].length - a[1].length)) {
    out.push(`**${label(modelId)}** 新增 ${rows.length} 格:` +
      rows.slice(0, 8).map(cell).join("、") + (rows.length > 8 ? ` 等 ${rows.length} 项` : ""));
  }
  if (moved.length) {
    out.push("");
    out.push(`**${moved.length} 个已有数字发生变化** —— 这些是站上本来就有、这次被改掉的:`);
    for (const row of moved.slice(0, 12)) {
      const direction = row.score > row.was ? "↑" : "↓";
      out.push(`- ${label(row.modelId)} · ${benchmarkName.get(row.benchmarkId) ?? row.benchmarkId}: ${row.was} → ${row.score} ${direction}`);
    }
    if (moved.length > 12) out.push(`- …另有 ${moved.length - 12} 个,未列出`);
  }
  for (const [modelId, rows] of lost) {
    out.push(`⚠ **${label(modelId)}** 少了 ${rows.length} 格:${rows.slice(0, 6).map(cell).join("、")}`);
  }
  if (moved.length === 0 && lost.size === 0) {
    out.push("");
    out.push("没有任何已有模型的数字被改动。");
  }
}

if (unverifiable.length) {
  out.push("");
  out.push(`⚠ **${unverifiable.length} 格落在只有单一来源的列上** —— 没有第二个源能反驳这些数,` +
    "跨源分歧闸门在这些列上不会响。归属对不对,这里没有任何检查看得出来:");
  for (const row of unverifiable.slice(0, 10)) {
    out.push(`- ${label(row.modelId)} · ${benchmarkName.get(row.benchmarkId) ?? row.benchmarkId} ${row.score}`);
  }
  if (unverifiable.length > 10) out.push(`- …另有 ${unverifiable.length - 10} 格,未列出`);
}

if (reclassified.length) {
  out.push("");
  out.push(`**${reclassified.length} 个格子的证据等级变了**(分数没动,但「谁测的」变了 —— 这会改变格子里哪一行当 primary):`);
  for (const row of reclassified.slice(0, 10)) {
    out.push(`- ${label(row.modelId)} · ${benchmarkName.get(row.benchmarkId) ?? row.benchmarkId}: ${row.from} → ${row.to}`);
  }
  if (reclassified.length > 10) out.push(`- …另有 ${reclassified.length - 10} 个,未列出`);
}

if (catalogChanges.length) {
  out.push("");
  out.push(`**目录记录里有 ${catalogChanges.length} 处数字变化**(速度、价格这类不是观测行,上面那几节看不到):`);
  for (const line of catalogChanges.slice(0, 14)) out.push(`- ${line}`);
  if (catalogChanges.length > 14) out.push(`- …另有 ${catalogChanges.length - 14} 处,未列出`);
}

process.stdout.write(out.join("\n") + "\n");
console.log(`<!-- changed-cells: ${gained.size + lost.size} models, ${moved.length + catalogChanges.length + reclassified.length} moved -->`);
// Read by the charter's fourth merge condition: an addition nothing can contradict stops.
console.log(`<!-- unverifiable-cells: ${unverifiable.length} -->`);
