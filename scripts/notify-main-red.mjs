// Decides whether a red `main` is worth a WeChat push, and writes the message when it is.
//
//   node scripts/notify-main-red.mjs            # in CI, reads GITHUB_* from the environment
//   node scripts/notify-main-red.mjs --self-test
//
// The step this replaces pushed on every red run. That is the wrong unit. On 2026-08-17 `main`
// ran CI eight times and went red eight times, every one of them the SAME single failure — a
// deliberately-red price term the owner had chosen to leave red — while a second session pushed
// commits through. Eight identical pushes for one known fact is how an alarm stops being read,
// and the next real failure arrives in a channel nobody opens any more.
//
// So the unit is a CHANGE of the failing set, not a red run:
//
//   the set differs from the previous completed run   -> push (this includes green -> red)
//   the set is unchanged but last seen on an earlier   -> push, once, as a daily reminder
//     UTC day
//   the set is unchanged and already seen today        -> stay silent
//   the set cannot be determined                       -> push
//
// The last rule is the load-bearing one. This repo's alarms have failed green twice (GOTCHAS 29,
// 34) and both times the failure mode was a check that could not reach its subject and said
// nothing. An unknown is not a quiet day: if the API is down, or the shape changed, or a job
// carries no recognisable failure, this pushes. A false push costs one notification; a swallowed
// one costs the next outage.
//
// No state is stored anywhere. The comparison is derived from the run history every time, so
// there is no cache to go stale and no file to commit — which also means a re-run of an old
// commit cannot poison a stored "last seen".
//
// ⚠ STDOUT IS THE MESSAGE AND NOTHING ELSE. The caller redirects it to a file and pushes the file
// if it is non-empty, so one `console.log` of a diagnostic makes the silent path push that
// diagnostic as the alert. That is not hypothetical: the first version shipped with the verdict
// line on stdout, and the very next red on `main` pushed "main-red notification: silent — …" to
// the owner's phone — an alarm announcing its own silence. Every diagnostic goes to stderr, where
// the Actions log still shows it, and `messageFor` is a pure function so the
// silent-means-empty property can be asserted rather than reviewed.

const args = process.argv.slice(2);

// ---------------------------------------------------------------- decision (pure)

/**
 * `current` and `previous` are `{ failed: string[], day: "YYYY-MM-DD" } | null`. A null means
 * "could not be determined", which is deliberately NOT the same as `{failed: []}` — one is an
 * unknown and pushes, the other is a green run and makes any red a change.
 */
export const decide = (current, previous) => {
  if (!current || !Array.isArray(current.failed)) {
    return { push: true, why: "could not read this run's failing steps — pushing rather than assuming a quiet day" };
  }
  if (!previous || !Array.isArray(previous.failed)) {
    return { push: true, why: "no readable previous run on main to compare against" };
  }

  const key = (set) => [...new Set(set)].sort().join(" | ");
  if (key(current.failed) !== key(previous.failed)) {
    return {
      push: true,
      why: previous.failed.length === 0
        ? "main was green on the previous run"
        : `the failing set changed (was: ${key(previous.failed) || "—"})`,
    };
  }
  if (previous.day !== current.day) {
    return { push: true, why: `same failure as the previous run, but that was on ${previous.day} — daily reminder` };
  }
  return { push: false, why: `identical to the previous run on ${previous.day}, already reported today` };
};

/**
 * The message, or the empty string when there is nothing to say. Pure, and separate from the
 * decision, so "silent produces nothing on stdout" is an assertion rather than a thing a reader
 * has to notice — the caller pushes whatever lands on stdout, so an empty string is the whole
 * safety property.
 */
export const messageFor = (verdict, { failing = [], sha = "", serverUrl = "", repo = "", runId = "" } = {}) => {
  if (!verdict.push) return "";
  const lines = [
    "**main 上的检查是红的**,而 EdgeOne 合并即发布、不看 CI——所以站已经是这个状态了。",
    "",
    failing.length > 0
      ? `红的是:${failing.map((name) => `「${name}」`).join("、")}`
      : "红的是哪一项去 run 里看(这次没读出来)。",
    "",
    `原因:${verdict.why}`,
    "",
    `提交:\`${sha}\``,
    "",
    `${serverUrl}/${repo}/actions/runs/${runId}`,
    "",
    "回滚是一个 revert 的事。⚠ 这条只在**红的集合发生变化**时推,同一个红每天最多提醒一次 ——",
    "**没有消息不等于绿了**。",
  ];
  return `${lines.join("\n")}\n`;
};

// ---------------------------------------------------------------- GitHub reads

const api = async (path) => {
  const token = process.env.GITHUB_TOKEN;
  const base = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const response = await fetch(`${base}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return response.json();
};

// A step that failed, named the way a reader sees it in the Actions UI. Steps still running when
// this executes have no conclusion yet and are not failures; only `failure` counts, so a
// cancelled or skipped step never reads as one.
const failedStepsOf = async (repo, runId) => {
  const { jobs } = await api(`/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`);
  return (jobs ?? []).flatMap((job) =>
    (job.steps ?? []).filter((step) => step.conclusion === "failure").map((step) => step.name),
  );
};

const day = (iso) => String(iso ?? "").slice(0, 10);

const readRuns = async (repo, workflowFile, currentRunId) => {
  const current = await api(`/repos/${repo}/actions/runs/${currentRunId}`);
  const list = await api(
    `/repos/${repo}/actions/workflows/${workflowFile}/runs?branch=main&event=push&status=completed&per_page=20`,
  );
  // The most recent completed push run on main that is not this one and started before it. The
  // ordering the API gives is newest-first, but a concurrent run can land out of order, so the
  // timestamp is compared rather than trusted.
  const previous = (list.workflow_runs ?? [])
    .filter((run) => String(run.id) !== String(currentRunId) && run.created_at < current.created_at)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

  return {
    current: { failed: await failedStepsOf(repo, currentRunId), day: day(current.created_at) },
    previous: previous
      ? {
          failed: previous.conclusion === "success" ? [] : await failedStepsOf(repo, previous.id),
          day: day(previous.created_at),
          url: previous.html_url,
        }
      : null,
  };
};

// ---------------------------------------------------------------- self-test

if (args.includes("--self-test")) {
  const today = "2026-08-17";
  const cases = [
    ["green -> red pushes", decide({ failed: ["check:prices"], day: today }, { failed: [], day: today }), true],
    ["identical set the same day stays silent", decide({ failed: ["check:prices"], day: today }, { failed: ["check:prices"], day: today }), false],
    ["identical set on an earlier day pushes once", decide({ failed: ["check:prices"], day: today }, { failed: ["check:prices"], day: "2026-08-16" }), true],
    ["a second failure joining the set pushes", decide({ failed: ["check:prices", "Lint"], day: today }, { failed: ["check:prices"], day: today }), true],
    ["a failure leaving the set pushes", decide({ failed: ["Lint"], day: today }, { failed: ["check:prices", "Lint"], day: today }), true],
    ["order does not matter", decide({ failed: ["Lint", "check:prices"], day: today }, { failed: ["check:prices", "Lint"], day: today }), false],
    ["an unreadable current run pushes", decide(null, { failed: ["check:prices"], day: today }), true],
    ["no previous run pushes", decide({ failed: ["check:prices"], day: today }, null), true],
    ["an unreadable previous run pushes", decide({ failed: ["check:prices"], day: today }, { failed: null, day: today }), true],
  ];

  // The 2026-08-17 shape itself, because that is the run this exists for: eight pushes to main,
  // one failing step, unchanged all day. Everything after the first should be silent.
  const timeline = ["2026-08-16", today, today, today, today, today, today, today, today];
  const pushes = timeline.filter((d, index) =>
    decide({ failed: ["Fail on a quoted price that has outlived its published end date"], day: d },
      index === 0 ? { failed: [], day: "2026-08-16" } : { failed: ["Fail on a quoted price that has outlived its published end date"], day: timeline[index - 1] },
    ).push,
  ).length;
  cases.push(["the 2026-08-17 timeline pushes twice, not nine times", { push: pushes === 2 }, true]);

  // The stdout contract, which is what actually broke on the first deploy: the caller pushes the
  // file it redirects stdout into, so a silent verdict must produce an empty string. Asserted on
  // the real function rather than reviewed by eye.
  const silent = decide({ failed: ["x"], day: today }, { failed: ["x"], day: today });
  const loud = decide({ failed: ["x"], day: today }, { failed: [], day: today });
  cases.push(["a silent verdict writes nothing to stdout", { push: messageFor(silent, { failing: ["x"] }) === "" }, true]);
  cases.push(["a pushing verdict writes a body naming the step", { push: messageFor(loud, { failing: ["x"] }).includes("「x」") }, true]);
  cases.push(["no diagnostic text leaks into the body", { push: !messageFor(loud, { failing: ["x"] }).includes("main-red notification") }, true]);

  let failures = 0;
  for (const [name, result, expected] of cases) {
    const ok = result.push === expected;
    if (!ok) failures += 1;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${result.why ? ` — ${result.why}` : ""}`);
  }
  console.log(failures === 0 ? "self-test passed" : `self-test FAILED: ${failures} case(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

// ---------------------------------------------------------------- CI path

const repo = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const workflowFile = process.env.WORKFLOW_FILE ?? "ci.yml";
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const sha = process.env.GITHUB_SHA ?? "";

if (!repo || !runId) {
  console.error("GITHUB_REPOSITORY and GITHUB_RUN_ID are required outside --self-test.");
  process.exit(1);
}

let observed = { current: null, previous: null };
try {
  observed = await readRuns(repo, workflowFile, runId);
} catch (error) {
  console.error(`::warning::could not read run history (${error.message}); pushing rather than assuming a quiet day`);
}

const verdict = decide(observed.current, observed.previous);
console.error(`main-red notification: ${verdict.push ? "PUSH" : "silent"} — ${verdict.why}`);

if (!verdict.push) {
  console.error("Silence here means UNCHANGED, not green. The red itself is still on the run page.");
}

process.stdout.write(messageFor(verdict, { failing: observed.current?.failed ?? [], sha, serverUrl, repo, runId }));
