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
const ROW = /modelId: "([^"]+)", benchmarkId: "([^"]+)", score: ([-\d.]+)[\s\S]*?harness: (null|"[^"]*")[\s\S]*?reasoningEffort: (null|"[^"]*")/;

const parse = (text) => {
  const rows = new Map();
  for (const line of text.split("\n")) {
    const match = ROW.exec(line);
    if (!match) continue;
    const [, modelId, benchmarkId, score, harness, effort] = match;
    const key = `${modelId}|${benchmarkId}|${harness}|${effort}`;
    rows.set(key, { modelId, benchmarkId, score: Number(score) });
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

const cellsOf = (rows) => {
  const cells = new Map();
  for (const row of rows.values()) {
    const key = `${row.modelId}|${row.benchmarkId}`;
    if (!cells.has(key)) cells.set(key, row);
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
for (const [key, row] of cellsAfter) {
  const was = cellsBefore.get(key);
  if (!was || was.score === row.score) continue;
  moved.push({ ...row, was: was.score });
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

const label = (modelId) => modelName.get(modelId) ?? modelId;
const cell = (row) => `${benchmarkName.get(row.benchmarkId) ?? row.benchmarkId} ${row.score}`;
const out = [];

if (gained.size === 0 && lost.size === 0 && moved.length === 0 && catalogChanges.length === 0) {
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

if (catalogChanges.length) {
  out.push("");
  out.push(`**目录记录里有 ${catalogChanges.length} 处数字变化**(速度、价格这类不是观测行,上面那几节看不到):`);
  for (const line of catalogChanges.slice(0, 14)) out.push(`- ${line}`);
  if (catalogChanges.length > 14) out.push(`- …另有 ${catalogChanges.length - 14} 处,未列出`);
}

process.stdout.write(out.join("\n") + "\n");
console.log(`<!-- changed-cells: ${gained.size + lost.size} models, ${moved.length + catalogChanges.length} moved -->`);
