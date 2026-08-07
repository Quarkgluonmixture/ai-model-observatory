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
import { BENCHMARKS, MODELS, OBSERVATIONS_BY_CELL, byPrimaryPreference } from "../app/model-data.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const STORE = "app/observations.generated.ts";
const baseRef = process.argv[2] ?? "HEAD";

const modelName = new Map(MODELS.map((model) => [model.id, model.name]));
const benchmarkName = new Map(BENCHMARKS.map((benchmark) => [benchmark.id, benchmark.name]));

// One row per line in the generated file, so a line-wise regex is exact rather than hopeful.
// `evaluationDate` is captured because the site's primary-row rule sorts on it; without it this
// script cannot reproduce which number a cell actually shows.
const ROW = /modelId: "([^"]+)", benchmarkId: "([^"]+)", score: ([-\d.]+)[\s\S]*?sourceLabel: "([^"]*)"[\s\S]*?sourceKind: "([^"]+)"[\s\S]*?evaluationDate: (null|"[^"]*")[\s\S]*?harness: (null|"[^"]*")[\s\S]*?reasoningEffort: (null|"[^"]*")/;

const unquote = (value) => (value === "null" ? null : value.slice(1, -1));

const parse = (text) => {
  const rows = new Map();
  for (const line of text.split("\n")) {
    const match = ROW.exec(line);
    if (!match) continue;
    const [, modelId, benchmarkId, score, sourceLabel, sourceKind, evaluationDate, harness, effort] = match;
    // `sourceLabel` belongs in the key. Without it, two sources publishing the same operating point
    // of the same model — which is the normal case for a board with an independent mirror — collide,
    // and `Map.set` silently keeps whichever appears last in the file. One of the two rows then does
    // not exist as far as this report is concerned.
    const key = `${modelId}|${benchmarkId}|${harness}|${effort}|${sourceLabel}`;
    rows.set(key, {
      modelId,
      benchmarkId,
      score: Number(score),
      sourceLabel,
      sourceKind,
      evaluationDate: unquote(evaluationDate),
    });
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
//
// ⚠ Third instance of the failure mode the two paragraphs above describe, found 2026-08-07. This
// function used to take **whichever row it parsed first** as the cell's value. File order is not
// the site's rule, and the two diverge exactly where it matters most: a cell holding several
// reasoning-effort variants from two sources — a benchmark-native board plus an independent mirror
// of that same board, which is the normal shape here.
//
// PR #45 was the demonstration. It reported:
//
//   Claude Opus 4.8 · ARC-AGI-2: 72.08 → 62.22 ↓
//   GPT-5.5 · ARC-AGI-2: 85 → 83.33 ↓
//
// The site's actual values were 72.08 → 72.1 and 85 → 85. Nothing dropped ten points; the ARC
// Prize rows simply sort earlier in the generated file than Epoch's mirror of them, so the "first
// row" for the cell became the low-effort one. The whole finding was an artefact of line order
// crossed with Map overwrite semantics, and it held a purely additive attribution out of `main`.
//
// This direction is the harmless one — a false alarm blocks a merge that was fine. The same defect
// produces the dangerous direction just as easily: a genuinely moved number in a cell whose
// first-parsed row does not change reports `moved: 0`, and `moved == 0` is one of the three
// conditions under which an automated change merges itself unattended.
//
// So the rule is imported from the module that renders the board rather than approximated here.
const cellsOf = (rows) => {
  const byCell = new Map();
  for (const row of rows.values()) {
    if (!byCell.has(row.benchmarkId + "|" + row.modelId)) byCell.set(row.benchmarkId + "|" + row.modelId, []);
    byCell.get(row.benchmarkId + "|" + row.modelId).push(row);
  }
  const cells = new Map();
  for (const [, group] of byCell) {
    // Same comparator, same argument, as app/model-data.ts uses to build OBSERVATIONS_BY_CELL.
    const sorted = [...group].sort(byPrimaryPreference(group[0].benchmarkId));
    const primary = sorted[0];
    cells.set(`${primary.modelId}|${primary.benchmarkId}`, {
      ...primary,
      kinds: new Set(group.map((row) => row.sourceKind)),
    });
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
// cfg() is positional, so this comparison is coupled to its signature — and the two revisions being
// compared do not have to share one. When Arena Elo left the signature on 2026-08-06, a single
// hard-coded field list read the base revision's arguments one slot off and reported `$out: 30 →
// 0.5`. Nothing failed; the report simply lied, into the one condition that decides whether an
// automatic change may merge itself. So each side's field list is read from its own copy of the
// signature, which also makes the next signature change a non-event here.
const LABELS = { costTask: "cost/task", input: "$in", output: "$out", textElo: "text Elo", codeElo: "code Elo" };
const SIGNATURE = /const cfg = \(([\s\S]*?)\):\s*ModelConfiguration/;
const fieldsOf = (text) => {
  const signature = text.match(SIGNATURE);
  if (!signature) return [];
  return signature[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*/, "").trim())
    .filter(Boolean)
    .map((line) => line.match(/^([A-Za-z_$][\w$]*)/)?.[1])
    .filter(Boolean)
    .map((name) => LABELS[name] ?? name);
};
const RECORD = /m\("([^"]+)",\s*"([^"]+)"[\s\S]{0,400}?cfg\(([^)]*)\)/g;
const parseCatalog = (text) => {
  const records = new Map();
  const fields = fieldsOf(text);
  for (const [, id, name, argsRaw] of text.matchAll(RECORD)) {
    const args = argsRaw.split(",").map((arg) => arg.trim());
    records.set(id, { name, args, fields });
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

// Arena Elo left the catalog text for the generated store, which put it outside this comparison —
// and this comparison is a merge condition. A daily Arena refresh moving every model's Elo would
// have been reported as "nothing changed", which is the exact failure this file was written to
// prevent, one field further along. So it is read from both revisions of the generated store.
//
// Reported, but deliberately NOT counted as a moved number: an Elo is a live measurement that moves
// with every vote, the same class as a cell moving on a live board. Counting it would make the
// merge condition permanently false once the board is fetched daily, which is how a gate becomes
// something to route around.
const ELO_ROW = /\{ modelId: "([^"]+)", effort: ([^,]+), textElo: ([^,]+), codeElo: ([^,}]+)/g;
const parseElo = (text) => {
  const rows = new Map();
  for (const [, id, effort, textElo, codeElo] of text.matchAll(ELO_ROW)) {
    rows.set(`${id}|${effort.replace(/"/g, "")}`, { textElo: textElo.trim(), codeElo: codeElo.trim() });
  }
  return rows;
};
const baseStore = (() => {
  try {
    return execSync(`git show ${baseRef}:${STORE}`, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return "";
  }
})();
const eloBefore = parseElo(baseStore);
const eloAfter = parseElo(readFileSync(join(ROOT, STORE), "utf8"));
const eloChanges = [];
// The revision that introduced the block would otherwise report every row as an addition. That is
// true and useless: it is a structural change, not 53 Elos moving.
const eloIsNew = eloAfter.size > 0 && eloBefore.size === 0;
for (const [key, after] of (eloIsNew ? [] : eloAfter)) {
  const before = eloBefore.get(key);
  const [id, effort] = key.split("|");
  const where = `${id}${effort && effort !== "null" ? ` (${effort})` : ""}`;
  for (const field of ["textElo", "codeElo"]) {
    const was = before?.[field];
    if (was === after[field]) continue;
    if (!before) { if (after[field] !== "null") eloChanges.push(`${where} · ${field} 新增 ${after[field]}`); continue; }
    eloChanges.push(`${where} · ${field}: ${was} → ${after[field]}`);
  }
}
for (const key of eloBefore.keys()) {
  if (!eloAfter.has(key)) eloChanges.push(`${key.split("|")[0]} · Arena 行消失`);
}
if (eloIsNew) eloChanges.push(`Arena Elo 首次从归档派生:${eloAfter.size} 个运行档位`);

const catalogChanges = [];
// Tracked separately from the other catalog changes because it is the one event the owner asked to
// be told about: the site gained a model. Everything else — a board moving, a maker publishing, AA
// measuring something — is now picked up by the pipeline without a person, so notifying on it
// trained the habit of not opening the notification.
const newModels = [];
let newModelFloorFailures = 0;
for (const [id, record] of catalogAfter) {
  const was = catalogBefore.get(id);
  if (!was) { catalogChanges.push(`新增目录记录 **${record.name}**`); newModels.push({ id, name: record.name }); continue; }
  // Compare by field NAME, not by index: the two revisions may lay their arguments out differently,
  // and a field that exists on only one side is a signature change rather than a number moving.
  for (const [index, field] of record.fields.entries()) {
    const wasIndex = was.fields.indexOf(field);
    if (wasIndex === -1) continue;
    const before = was.args[wasIndex];
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

if (gained.size === 0 && lost.size === 0 && moved.length === 0 && catalogChanges.length === 0 && reclassified.length === 0 && eloChanges.length === 0) {
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

if (eloChanges.length) {
  out.push("");
  out.push(`**人类偏好 Elo 有 ${eloChanges.length} 处变化**(实时测量,不计入"已有数字被改动"):`);
  for (const line of eloChanges.slice(0, 12)) out.push(`- ${line}`);
  if (eloChanges.length > 12) out.push(`- …另有 ${eloChanges.length - 12} 处,未列出`);
}

// --- What a new catalog record actually brings ----------------------------------------------
//
// The three conditions an unattended change must clear do not cover this one, and that was
// measured rather than assumed: a catalog record with NO evidence behind it passes `check:data`,
// passes `check:models` with exit 0, and passes `check:prices`. All three contracts are green on a
// model whose row is empty across every column. What refuses such a merge today is that a new
// record counts toward this report's `moved` tally — a side effect of how the report is written,
// not a gate anyone designed for the purpose, and one that disappears the moment a merge path
// stops reading `moved`.
//
// So the measurement is printed here, where the merge decision already looks. The floor is
// arithmetic and not an editorial threshold: adding a model widens the grid by one full
// column-count, so (filled + k) / ((models + 1) × benchmarks) beats filled / (models × benchmarks)
// exactly when k > filled / models — the average cells a model already carries. It is recomputed
// from the base revision every run because it moves as the board fills.
//
// An empty row is not merely untidy. Cell coverage is the metric `AGENTS.md` calls the only one
// that matters, and a record with nothing behind it lowers it while adding no information: the
// model ranks nowhere, reads `N/A` in every lens, and occupies a row that says only that somebody
// heard the model exists.
if (newModels.length) {
  // Counted from OBSERVATIONS_BY_CELL rather than from this script's own parse of the generated
  // store, and the difference is not cosmetic: the store holds only the ingested rows, while the
  // board also carries the seed observations written into `app/model-data.ts`. Measured today,
  // parsing the store alone put the floor at 36 where the real board says 38 — an understatement,
  // which for a floor is the permissive direction and therefore the wrong one.
  //
  // The new models are excluded from both sides. Including them would let a batch of thin records
  // lower the average they are then measured against, which is a floor that sinks under load.
  const newIds = new Set(newModels.map((model) => model.id));
  const established = MODELS.filter((model) => !newIds.has(model.id));
  const establishedCells = established.reduce(
    (total, model) => total + Object.keys(OBSERVATIONS_BY_CELL[model.id] ?? {}).length, 0,
  );
  const floor = established.length ? Math.ceil(establishedCells / established.length) : 0;
  const lines = [];
  let below = 0;
  for (const model of newModels) {
    const brought = Object.keys(OBSERVATIONS_BY_CELL[model.id] ?? {}).length;
    const verdict = brought === 0
      ? "**空行** —— 每一列都是 N/A,只会把覆盖率往下拉"
      : brought > floor
        ? `高于 ${floor} 格地板,不稀释覆盖率`
        : `低于 ${floor} 格地板 —— 加了它覆盖率会下降`;
    if (brought <= floor) below += 1;
    lines.push(`- **${model.name}** 带来 ${brought} 格:${verdict}`);
  }
  out.push("");
  out.push(
    `**新增目录记录的证据量**(地板 ${floor} 格 = 现有模型的平均格数,算出来的、不是定出来的):`,
  );
  out.push(...lines);
  if (below) {
    out.push("");
    out.push(
      `⚠ 其中 ${below} 条**没到地板**。三项契约对空行全部亮绿 —— 这一节是唯一会说出来的地方。`,
    );
  }
  // Machine-readable, so a merge path can refuse on it instead of relying on `moved` catching a
  // new record by accident.
  newModelFloorFailures = below;
}

process.stdout.write(out.join("\n") + "\n");
console.log(`<!-- changed-cells: ${gained.size + lost.size} models, ${moved.length + catalogChanges.length + reclassified.length} moved -->`);
console.log(`<!-- elo-changes: ${eloChanges.length} -->`);
console.log(`<!-- new-models: ${newModels.map((m) => m.name).join(" · ")} -->`);
// Reported, deliberately NOT a merge condition. A gate on it was measured and rejected: 47 of the
// 70 columns had a single source, so refusing every addition that lands in one would refuse almost
// every addition, and a check that is always red is a check nobody reads. (This comment used to
// claim it was "read by the charter's fourth merge condition". Nothing read it, and no fourth
// condition existed — the docs were right and the comment was wrong.)
console.log(`<!-- unverifiable-cells: ${unverifiable.length} -->`);
// This one IS meant to be read: how many new catalog records arrived below the dilution floor.
// Zero is the only value an unattended merge may proceed on.
console.log(`<!-- new-models-below-floor: ${newModelFloorFailures} -->`);
