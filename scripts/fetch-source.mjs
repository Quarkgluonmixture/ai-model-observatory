// Re-reads the scripted sources and either writes their batch or diffs it against the archive.
//
//   node scripts/fetch-source.mjs                 # re-fetch every scripted source, write changes
//   node scripts/fetch-source.mjs deepswe         # just one
//   node scripts/fetch-source.mjs --check         # compare archive against upstream, write nothing
//   node scripts/fetch-source.mjs livebench --version 2026-07-30
//   node scripts/fetch-source.mjs deepswe --stdout
//
// The two verdicts this tool produces are deliberately different, because conflating them is how
// a check gets ignored:
//
//   pinned source, a cell moved     integrity failure. The archive no longer matches its source
//                                   under a version that is supposed to be frozen. Exit 1.
//   live source, a cell moved       new data. DataCurve appends DeepSWE runs and the pass rates
//                                   move; that is the board working. Exit 0, and the weekly job
//                                   opens a pull request with the rewritten batch.
//
// Writing is idempotent on purpose. When the fetched rows equal the archived rows nothing is
// touched — not even the sidecar's retrievedDate — so a weekly refresh of an unchanged source
// produces no diff and therefore no pull request.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FETCHERS, fetcherById } from "./fetchers/index.mjs";

// fileURLToPath, not .pathname: on Windows a file URL's pathname is "/C:/..." — a
// leading slash that fs cannot resolve. The agent maintaining this runs there.
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const argOf = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};

const checkOnly = flag("check");
const toStdout = flag("stdout");
const requested = args.filter((arg) => !arg.startsWith("--") && arg !== argOf("version"));
// --live selects only the boards that legitimately move, which is what the weekly refresh
// re-reads. A pinned source can only produce a drift failure there, and a failure on LiveBench
// must not stop DeepSWE's new rows from reaching a pull request.
const pool = flag("live") ? FETCHERS.filter((fetcher) => fetcher.versioning === "live") : FETCHERS;
const selected = requested.length ? requested.map((id) => {
  const fetcher = fetcherById(id);
  if (!fetcher) throw new Error(`unknown source "${id}" — known: ${FETCHERS.map((f) => f.id).join(", ")}`);
  return fetcher;
}) : pool;

const pathsFor = (fetcher) => ({
  jsonl: join(ROOT, `data/sources/${fetcher.batch}.jsonl`),
  meta: join(ROOT, `data/sources/${fetcher.batch}.meta.json`),
});

const readArchive = (fetcher) =>
  readFileSync(pathsFor(fetcher).jsonl, "utf8").trim().split("\n").map((line) => JSON.parse(line));

const serialise = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

const today = () => new Date().toISOString().slice(0, 10);

let failed = false;
let changedAny = false;

for (const fetcher of selected) {
  // An on-demand source with no credential configured is not a failure: it simply has nothing
  // to say this run. Failing here would make the weekly drift check depend on a secret that
  // deliberately is not part of it.
  if (fetcher.available && !fetcher.available()) {
    console.log(fetcher.unavailableReason ?? `${fetcher.label}: unavailable, skipping.`);
    continue;
  }

  const archived = (() => {
    try { return readArchive(fetcher); } catch { return null; }
  })();

  // A pinned source is re-read at the version the archive holds, so the comparison is faithful:
  // fetching whatever is newest would compare two different question sets and call it drift.
  const target = argOf("version")
    ?? (fetcher.versioning === "pinned" && archived ? fetcher.archiveVersion(archived) : null);

  const { rows, version, summary, meta } = await fetcher.fetch(target);

  if (toStdout) {
    process.stdout.write(serialise(rows));
    continue;
  }

  // An explicit --version is a deliberate re-collection, not a drift check. Diffing a new
  // LiveBench release against the archived one would report every cell as moved and refuse to
  // write, which is the opposite of what was asked for.
  if (argOf("version") && !checkOnly) {
    writeFileSync(pathsFor(fetcher).jsonl, serialise(rows));
    writeFileSync(pathsFor(fetcher).meta, JSON.stringify({ ...meta, retrievedDate: today() }, null, 2) + "\n");
    console.log(`Wrote ${fetcher.batch} at ${version}: ${summary}`);
    changedAny = true;
    continue;
  }

  // The key has to name a configuration, not a model. LiveBench puts the effort inside the model
  // string so model+benchmark was unique there; DeepSWE publishes three efforts under one model
  // name, and keying on model alone would silently compare only the last of them.
  //
  // A parameter batch has no benchmark or score at all — it describes models, not results — so it
  // is keyed on the configuration and compared on the whole measured row. Reusing the observation
  // key there produced "model/undefined" for every row and compared undefined to undefined.
  const isParameters = rows[0] && rows[0].benchmark === undefined;
  const cellKey = isParameters
    ? (row) => `${row.model_raw}/${row.effort ?? "-"}`
    : (row) => `${row.model_raw}/${row.benchmark}/${row.harness ?? "-"}/${row.reasoning_effort ?? "-"}`;
  const cellValue = isParameters
    ? (row) => JSON.stringify([row.intelligence_index, row.cost_per_task_usd, row.output_tokens_per_s,
        row.latency_first_chunk_s, row.price_input_per_m, row.price_output_per_m, row.price_cache_per_m])
    : (row) => row.score;
  const upstream = new Map(rows.map((row) => [cellKey(row), cellValue(row)]));
  const stored = new Map((archived ?? []).map((row) => [cellKey(row), cellValue(row)]));

  const changed = [];
  const gone = [];
  for (const [key, score] of stored) {
    if (!upstream.has(key)) gone.push(key);
    else if (upstream.get(key) !== score) changed.push(`${key}: archived ${score} -> upstream ${upstream.get(key)}`);
  }
  const added = [...upstream.keys()].filter((key) => !stored.has(key));
  const differences = [
    ...changed.map((entry) => `changed  ${entry}`),
    ...gone.map((entry) => `removed  ${entry} (in the archive, absent upstream)`),
    ...added.map((entry) => `appeared ${entry} (upstream, missing from the archive)`),
  ];

  // Reported for a pinned source and never failed on: a new release is new data, and the old
  // rows stay valid for the release they name. Collecting it is a catalog decision, not a fetch.
  if (fetcher.latestVersion) {
    const latest = await fetcher.latestVersion();
    if (latest !== version) {
      console.log(`note: ${fetcher.label} has published ${latest}; the archive holds ${version}.`);
      console.log(`      Run: node scripts/fetch-source.mjs ${fetcher.id} --version ${latest}`);
    }
  }

  const label = `${fetcher.label} ${version}`;

  if (differences.length === 0) {
    console.log(`${label}: archive matches upstream, ${stored.size} cells verified.`);
    continue;
  }

  const listing = differences.slice(0, 40).map((entry) => `  ${entry}`).join("\n") +
    (differences.length > 40 ? `\n  … ${differences.length - 40} more` : "");

  if (fetcher.versioning === "pinned") {
    console.error(`\n${label} no longer matches its archive — ${differences.length} cell(s):\n${listing}`);
    failed = true;
    continue;
  }

  console.log(`\n${label}: ${differences.length} cell(s) moved upstream — this board is live, so this is new data:\n${listing}`);
  changedAny = true;

  if (checkOnly) continue;

  writeFileSync(pathsFor(fetcher).jsonl, serialise(rows));
  writeFileSync(
    pathsFor(fetcher).meta,
    JSON.stringify({ ...meta, retrievedDate: today() }, null, 2) + "\n",
  );
  console.log(`Wrote ${fetcher.batch}: ${summary}`);
}

// A live source that moved is news, not a failure, so it is announced on stdout for the workflow
// to act on rather than folded into the exit code.
if (changedAny && checkOnly) console.log("\nARCHIVE_STALE=1");
process.exit(failed ? 1 : 0);
