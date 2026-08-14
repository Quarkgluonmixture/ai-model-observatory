// 每一列的观测行是「每日自动重读」的,还是靠手抄 / 靠不每日跑的脚本?
//
//   node --experimental-strip-types scripts/report-column-automation.mjs
//
// 存在的理由:CHECKPOINT 里那句「72 列里 53 列每日自动重读」是承重判断 —— 它决定「自动化够不够」
// 这个问题的答案。写成散文里的一个数字,下个月就没人能复算,也没人知道它是怎么算的
// (GOTCHAS 26:引用别处写下的格数之前先自己数)。所以它是一条命令,不是一句话。
//
// 分类口径:按每一列的观测行来自哪个批次,批次再经 fetcher 注册表映射到 versioning ——
// `live` / `append-only` 才进日常 job 的重读循环(见 scripts/fetch-source.mjs 的 --check),
// `manual`(AA 两个源)不进,是故意的:AA 持续重测,每天重写会天天让 check:models 变红。
const { readArchiveFiles, buildResolvers, loadAliasConfig } = await import("./lib/archive.mjs");
const { FETCHERS } = await import("./fetchers/index.mjs");
const { BENCHMARKS, OBSERVATIONS_BY_CELL, MODELS } = await import("../app/model-data.ts");

const config = loadAliasConfig();
const { isDropped, supersededBy } = buildResolvers(config);
const aliases = new Map((config.benchmarkAliases ?? []).map(e => [e.benchmark, e.benchmarkId]));
const splits = new Map((config.benchmarkSplits ?? []).map(e => [`${e.benchmark}|${e.benchmarkVersion}`, e.benchmarkId]));
const fallbacks = new Map((config.versionFallbacks ?? []).flatMap(e => e.benchmarks.map(n => [n, e.version])));
const columns = new Set(BENCHMARKS.map(b => b.id));
const columnFor = (file, raw) => {
  if (!raw.benchmark || isDropped(raw.benchmark)) return null;
  if (supersededBy(file, raw.benchmark, raw.benchmark_version, null, raw.model_raw)) return null;
  const canonical = aliases.get(raw.benchmark) ?? raw.benchmark;
  if (!raw.benchmark_version && !fallbacks.get(canonical)) return null;
  const id = splits.get(`${canonical}|${raw.benchmark_version}`) ?? canonical;
  return columns.has(id) ? id : null;
};

const batchKind = new Map();
for (const f of FETCHERS) {
  const daily = f.versioning === "live" || f.versioning === "append-only";
  batchKind.set(`${f.batch}.jsonl`, daily ? "daily" : "scripted-manual");
}

const { batches } = readArchiveFiles();
const perColumn = new Map();
for (const { file, rows } of batches) {
  const kind = batchKind.get(file) ?? "hand";
  for (const { raw } of rows) {
    const col = columnFor(file, raw);
    if (!col) continue;
    if (!perColumn.has(col)) perColumn.set(col, new Map());
    const m = perColumn.get(col);
    m.set(kind, (m.get(kind) ?? 0) + 1);
  }
}

const filled = {};
for (const mo of MODELS) for (const c of Object.keys(OBSERVATIONS_BY_CELL[mo.id] ?? {})) filled[c] = (filled[c] ?? 0) + 1;

let daily = 0, scriptedManual = 0, hand = 0, none = 0;
const handCols = [], manualCols = [];
for (const b of BENCHMARKS) {
  const m = perColumn.get(b.id);
  if (!m) { none++; handCols.push(`${b.id}(无归档行)`); continue; }
  if (m.get("daily")) daily++;
  else if (m.get("scripted-manual")) { scriptedManual++; manualCols.push(`${b.id}[${filled[b.id]??0}格]`); }
  else { hand++; handCols.push(`${b.id}[${filled[b.id]??0}格]`); }
}
console.log(`目录列总数: ${BENCHMARKS.length}`);
console.log(`  每日自动重读覆盖 : ${daily}`);
console.log(`  只有 AA 脚本(不每日): ${scriptedManual}`);
console.log(`  只有手抄行       : ${hand}`);
console.log(`  归档里没有行     : ${none}`);
console.log();
console.log("只有 AA 脚本(每日不跑)的列:", manualCols.join(", ") || "-");
console.log();
console.log("只有手抄行 / 无行的列:", handCols.join(", ") || "-");
