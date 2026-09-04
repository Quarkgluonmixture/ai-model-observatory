// Asks whether the other scheduler is still alive.
//
//   node scripts/check-heartbeat.mjs --github   # run by the agent: did GitHub's daily job run?
//   node scripts/check-heartbeat.mjs --agent    # run by GitHub: has the agent done anything?
//
// Exits 1 when a heartbeat is missing, 0 when it is present or cannot be determined.
//
// ## Why this exists
//
// On 2026-08-06 this project cut its WeChat notifications from ten to four, on the grounds that
// six of them reported events nobody could act on. That was right. The cost, which was not priced
// in at the time, is that **silence now means three different things**: everything is fine, the
// GitHub side is dead, or the scheduled agent is dead. A channel that only speaks on exceptions is
// only trustworthy if the absence of a message is itself checkable.
//
// It is not hypothetical. `AGENTS.md` records that the daily refresh runs `npm run build` before it
// will commit anything, and that the build now includes the personal site — so a type error in
// `app/page.tsx` stops the data pipeline dead. Nothing reaches main, no pull request opens, no
// notification fires, and the only symptom is an absence. The same shape applies on the other side:
// the Windows agent had no scheduled task at all until 2026-08-06 and only ran when somebody opened
// a chat window, which was invisible from here.
//
// Two schedulers that never look at each other cannot report each other's death. So each one
// checks the other, using artefacts that already exist. Nothing new is written and no new
// notification is introduced on the happy path.
//
// ## What counts as a heartbeat, and why these thresholds
//
// `--github` — the `Upstream` workflow completing a run. It runs daily on a cron and writes a run
// record whether or not anything moved, so its absence is unambiguous. Threshold 36 hours: GitHub
// delays scheduled workflows on shared runners, sometimes by two hours or more (the 06:00 cron in
// upstream.yml has been observed firing anywhere from 06:56 to 08:10), so a 24-hour window would
// cry wolf on a normal late start.
//
// `--agent` — any commit on main that is not this repository's bot. Threshold **3 days**, not one,
// and the difference is the whole design: an agent that finds nothing worth doing correctly
// produces nothing, so a quiet day is not a dead agent. Three quiet days with a non-empty
// collection queue is a different claim, and that is the one worth making. This deliberately
// cannot distinguish the agent from the owner — both push as a person — so it answers "has
// anything human-shaped touched this repository", which is the question that matters for
// "is the queue being worked".

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const wantGithub = args.includes("--github");
const wantAgent = args.includes("--agent");
if (!wantGithub && !wantAgent) {
  console.error("usage: node scripts/check-heartbeat.mjs (--github | --agent)");
  process.exit(2);
}

const BOT = "github-actions[bot]";
const GITHUB_MAX_HOURS = 36;
const AGENT_MAX_DAYS = 3;

const repo = (() => {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
    return /github\.com[:/](.+?)(?:\.git)?$/.exec(url)?.[1] ?? null;
  } catch { return null; }
})();

if (!repo) {
  console.log("Could not work out which repository this is; skipping the heartbeat check.");
  process.exit(0);
}

// The token is optional. This repository is public, so an unauthenticated read works and the check
// still runs on a machine that has no gh credentials — which is exactly the machine most likely to
// be the one that is broken.
const api = async (path) => {
  const headers = { accept: "application/vnd.github+json", "user-agent": "quarkspace-heartbeat" };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
};

const hoursSince = (iso) => (Date.now() - new Date(iso).getTime()) / 3_600_000;
const fmt = (hours) => (hours < 48 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`);

let failed = false;

if (wantGithub) {
  try {
    const { workflow_runs: runs = [] } = await api("/actions/workflows/upstream.yml/runs?per_page=1");
    const last = runs[0];
    if (!last) {
      console.log(`⚠ The Upstream workflow has no run on record at all. Check ${repo}'s Actions tab.`);
      failed = true;
    } else {
      const age = hoursSince(last.created_at);
      if (age > GITHUB_MAX_HOURS) {
        console.log(`⚠ GitHub's daily job last ran ${fmt(age)} ago (${last.created_at}), over the ${GITHUB_MAX_HOURS}h threshold.`);
        console.log("  Nothing is refreshing sources, watching release pages, or writing the gaps issue.");
        console.log(`  ${last.html_url}`);
        failed = true;
      } else if (last.conclusion && last.conclusion !== "success") {
        // A failed run is still a heartbeat — the scheduler is alive — but the work did not happen,
        // and a job that fails before its reporting steps cannot report its own failure.
        console.log(`⚠ GitHub's daily job ran ${fmt(age)} ago but concluded "${last.conclusion}".`);
        console.log(`  ${last.html_url}`);
        failed = true;
      } else {
        console.log(`GitHub's daily job is alive: last run ${fmt(age)} ago, ${last.conclusion ?? last.status}.`);
      }
    }
  } catch (error) {
    // Never turn a caller red because the API was unreachable. An unknown heartbeat is not a dead
    // one, and the whole point of this check is to be trustworthy about what it does and does not
    // know — the same contract notify-pushplus.mjs follows for a channel it cannot reach.
    console.log(`Could not reach the GitHub API to check the daily job (${error.message}); heartbeat unknown.`);
  }
}

if (wantAgent) {
  try {
    const commits = await api("/commits?sha=main&per_page=50");
    const human = commits.find((commit) => (commit.author?.login ?? commit.commit?.author?.name) !== BOT
      && commit.commit?.author?.name !== "github-actions[bot]");
    if (!human) {
      console.log(`No non-bot commit in the last ${commits.length} on main — the queue may not be being worked.`);
      failed = true;
    } else {
      const days = hoursSince(human.commit.author.date) / 24;
      if (days > AGENT_MAX_DAYS) {
        console.log(`⚠ Nothing but this bot has touched main for ${days.toFixed(1)} days (last: \`${human.sha.slice(0, 7)}\`, ${human.commit.author.date}).`);
        console.log("  Either the scheduled agent is not running, or every item in this queue is blocked.");
        failed = true;
      } else {
        console.log(`The queue is being worked: last non-bot commit ${days.toFixed(1)} day(s) ago (\`${human.sha.slice(0, 7)}\`).`);
      }
    }
  } catch (error) {
    console.log(`Could not reach the GitHub API to check for agent activity (${error.message}); heartbeat unknown.`);
  }
}

process.exit(failed ? 1 : 0);
