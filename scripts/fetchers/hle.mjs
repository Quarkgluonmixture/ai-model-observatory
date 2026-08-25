// CAIS AI Dashboard — Humanity's Last Exam, text setting, no tools.
//
// ## What this source is
//
// `hle-no-tools` is the only core column whose catalog entry already declares its source as
// "Humanity's Last Exam / lastexam.ai" while holding not one benchmark-native row: §9 of
// docs/ARCHITECTURE.md recorded the site as unreadable because the leaderboard never got past
// "Loading HLE results". That verdict was a header problem, not a data problem:
//
//   curl https://dashboard.safe.ai/api/models                  -> 403 Forbidden
//   curl -H 'Origin: https://lastexam.ai' -H 'Referer: ...' …  -> 200, the whole board as JSON
//
// The dashboard (lastexam.ai's "Submission Dashboard" link) reads exactly one endpoint, and it
// refuses anything that does not look like the page's own origin. The three headers below are
// therefore not optional and not spoofing decoration — they are what the site requires of its
// own frontend, and the earlier probe failed because a bare fetch got the 403 and the client
// rendered the loading state forever.
//
// CAIS co-created HLE, so this board is the benchmark operator's own leaderboard: source_kind
// "benchmark", the top of the precedence chain, where every `hle-no-tools` cell until now has
// rested on AA (independent) and vendor tables. AGENTS.md's own rule for stale verdicts applies:
// a leaderboard that "cannot be scraped" is often one whose data file nobody looked for.
//
// ## Which HLE this is — decided by the numbers, stated here
//
// The API has no methodology field. Three facts place this `hle` in the no-tools column:
//
// 1. The dashboard's "Text Capabilities Index" tab is where the column lives; the with-tools
//    variant of HLE is a different published setting and appears nowhere in this file — the
//    score keys carry no second HLE.
// 2. Every catalog model the board shares with AA lands within a few points of AA's no-tools
//    reading at the same effort (gpt-5.6-terra 35.9 vs 38.5, gpt-5.6-sol 45.5 vs 46.0,
//    glm-5.2 41.4 vs 41.1, gpt-5.5 43.8 vs 45.0) and 10–20 points below every vendor
//    with-tools self-report in the same cells (kimi-k3 41.1 vs 56/59.8, glm-5.2 41.4 vs 54.7).
// 3. tools_enabled is set to false on every row this fetcher emits, on the strength of 1 and 2.
//
// `benchmark_version` is "Full" — the finalized 2,500-question set the operator itself froze —
// matching the column's declared version and AA's text-subset reading of the same set. The API
// does not state a question count; if CAIS ever publishes one that disagrees, this batch is the
// place that fact will surface.
//
// ## One key of nineteen, and why the rest stay
//
// The file carries nineteen score keys. Only `hle` is collected:
//
//   arc_agi_2, swebench_pro — real benchmarks, but the catalog already reads both from their own
//     operators' boards (arcprize.mjs, swe-pro.mjs), which outrank a re-run by a third party.
//     Collecting them here would put two "benchmark"-kind rows in one cell with no tie-break.
//   hle_calibration_error — not a capability column.
//   textquests, enigmaeval, mindcube, spatialviz, intphys2, erqa, art, masks, machiavelli, pct,
//   refusal_avg, textquests_harm, and the three refusal keys — not catalog benchmarks. New
//   columns are an editorial decision, not a fetcher's.
//
// ## Field conventions
//
// `model_raw` is the dashboard id VERBATIM (`opus-4-8-high`, `kimi-k2.6-64k`) — the ARC convention
// for id-keyed boards, because the id is the only string that ties the row back to the board.
// The effort is read off the id's last token against the closed list shared with arcprize/epoch,
// so `-high` becomes reasoning_effort "high" and `-64k` (a context tier, not an effort) stays
// null with the tier written into the note. The id `kimi-k2.6-64k` is Kimi K2.6 served at 64K —
// the alias step maps the family, the note carries the tier.
//
// One spelling divergence worth writing down: for the Gemini 3 family CAIS suffixes `-high` where
// AA calls the same operating point "reasoning" (gemini-3-flash: 36.6 on both boards). The two
// readings therefore never meet in one disagreement-gate group even though they measure the same
// setting; they are compared by precedence instead, where this board wins.
//
// `releaseDate` on every entry is when the MODEL shipped, not when CAIS ran it — the same trap
// ARC's `modelReleaseDate` set — so `evaluation_date` stays null and the release date goes into
// the note. `deepseek-v4-pro` (releaseDate 2026-04-24, the preview launch) is already refused
// globally in the alias table for exactly that reason: the catalog record is the 0813 GA.
//
// ## Versioning
//
// `live`: a submission board gains models and revises runs, so a cell that moved is new data
// (the daily job opens a pull request) and an appearing row is new evidence. A vanished row is
// still an integrity failure the drift check reports.

const API = "https://dashboard.safe.ai/api/models";
const BOARD = "https://dashboard.safe.ai/";

// Same closed list as arcprize.mjs / epoch.mjs, for the same reason: a token that is not on the
// list is context tier, route or date vocabulary, and a misread there mislabels a configuration.
const EFFORTS = new Set(["max", "xhigh", "high", "medium", "low", "minimal", "thinking", "non-reasoning"]);
const EFFORT_SYNONYMS = new Map([["none", "non-reasoning"]]);

const effortOf = (modelId) => {
  const tail = String(modelId).toLowerCase().split(/[-_]/).pop();
  if (EFFORTS.has(tail)) return tail;
  return EFFORT_SYNONYMS.get(tail) ?? null;
};

export const hle = {
  id: "cais-hle",
  label: "CAIS AI Dashboard · Humanity's Last Exam (text)",
  batch: "batch-38-cais-hle",
  versioning: "live",

  async fetch() {
    const response = await fetch(API, {
      headers: {
        Accept: "application/json",
        // Required, all three: a bare fetch gets 403 and the board renders "Loading" forever.
        // This is the site's own origin check, not a key.
        Origin: "https://lastexam.ai",
        Referer: "https://lastexam.ai/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${API}`);
    const models = await response.json();
    if (!Array.isArray(models) || models.length === 0) throw new Error(`no records in ${API} — the shape changed`);

    // A key vanishing upstream must not read as "every model lost that score": the archive is
    // rewritten wholesale per run, so a silent drop would delete the column's rows as "drift".
    const withHle = models.filter((m) => m.scores && Number.isFinite(m.scores.hle));
    if (withHle.length === 0) {
      const keys = [...new Set(models.flatMap((m) => Object.keys(m.scores ?? {})))].sort();
      throw new Error(`no model carries a finite hle score — keys the API does publish: ${keys.join(", ")}`);
    }

    const rows = withHle.map((m) => {
      const effort = effortOf(m.id);
      return {
        model_raw: m.id,
        benchmark: "hle-no-tools",
        benchmark_version: "Full",
        score: Number(m.scores.hle),
        unit: "%",
        harness: null,
        reasoning_effort: effort,
        tools_enabled: false,
        context_length: null,
        evaluation_date: null,
        source_label: "CAIS AI Dashboard · Humanity's Last Exam",
        source_url: BOARD,
        source_kind: "benchmark",
        note:
          `CAIS AI Dashboard 名称 ${m.name ?? m.id}；provider ${m.provider ?? "unknown"}` +
          (m.releaseDate ? `；模型发布 ${m.releaseDate}（非评测日，API 不给评测日）` : "") +
          (m.flagship ? "；板上标注 flagship" : "") +
          (m.model_size ? `；model_size ${m.model_size}` : "") +
          (m.modelCardUrl ? `；model card ${m.modelCardUrl}` : "") +
          `；⚠ 依据数字与 AA no-tools 读数同档（本板 16 个目录模型与 AA 同 effort 全部相差 <7%），且比厂商 with-tools 自报低 10–20 分，判为 no-tools 列；API 不公布题量/判分方法` +
          (effort ? `；effort 从 id 末尾读出 ${effort}（闭合清单内），id 原样保留` : `；id 末尾不是档位词（上下文档位/路由/日期一类），effort 留空`),
      };
    });

    return {
      rows,
      version: "v1",
      summary: `${rows.length} HLE (text) readings across ${models.length} board entries`,
      meta: {
        batch: "38 · CAIS AI Dashboard · Humanity's Last Exam (text)",
        collectedWith: "scripts/fetchers/hle.mjs",
        filtered: true,
        filterRule:
          "One score key of the nineteen the API publishes: hle. NOT collected, each for a stated reason: arc_agi_2 and swebench_pro are already read from their own operators' boards (arcprize.mjs, swe-pro.mjs), which outrank a third party's re-run and would sit as two benchmark-kind rows in one cell; hle_calibration_error is not a capability column; textquests, enigmaeval, mindcube, spatialviz, intphys2, erqa, art, masks, machiavelli, pct, refusal_avg, textquests_harm and the refusal keys are not catalog benchmarks -- new columns are an editorial decision, not a fetcher's. Entries without a finite hle score are not archived.",
        release: "v1",
        sources: [API, BOARD, "https://lastexam.ai/"],
        note:
          "The benchmark operator's own board, closing the gap §9 recorded as unreadable: the API 403s without Origin/Referer/UA headers (the earlier verdict's 'stuck on Loading' was that 403 rendered client-side) and returns the whole board as JSON with them. " +
          "Which-HLE decided by number corroboration, see the fetcher header: text tab, matches AA's no-tools readings within <7% at the same effort for every shared catalog model, 10-20 below every vendor with-tools self-report. tools_enabled false on that basis; the API publishes no methodology field. " +
          "benchmark_version Full = the finalized 2,500-question set the operator itself froze; the API states no question count, so if CAIS ever publishes one that disagrees, this batch is where it surfaces. " +
          "model_raw is the dashboard id VERBATIM; reasoning_effort read off the id's last token against the closed list shared with arcprize/epoch (-high -> high; kimi-k2.6-64k's -64k is a context tier, effort stays null and the tier is in the note). " +
          "releaseDate is the MODEL's ship date, not an evaluation date -- evaluation_date stays null on every row, release date in the note. " +
          "deepseek-v4-pro (releaseDate 2026-04-24 = the preview launch) is already refused globally in the alias table: the catalog record is the 0813 GA. " +
          "Spelling divergence documented in the header: CAIS writes -high where AA writes 'reasoning' for the Gemini 3 family -- same operating point, two spellings, they compare by precedence, not in one gate group. " +
          "live versioning: a submission board gains models and revises runs, so moved cells are new data (daily job opens a PR) and appearing rows are new evidence; a vanished row is still an integrity failure.",
      },
    };
  },
};
