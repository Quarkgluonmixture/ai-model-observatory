// What upstream serves that is not a model of its own.
//
// A provider's model list mixes three kinds of thing: models, operating points of a model, and
// pricing tiers of a model. Only the first is a candidate for this catalog — AGENTS.md rule 7 puts
// an operating point in `configurations`, and a record of its own would enter every ranking as a
// second copy of a model the catalog already carries.
//
// This file exists because the rule was written twice and applied once. `report:gaps` filtered
// these out; `app/api/live-models` never learned to, so the daily issue read clean while the site
// itself showed eight names of which five were `(batch)` or `(Fast)` tiers of models already in the
// catalog. Two code paths printed the same sentence and only one had the filter. There is now one
// home: the route, `scripts/report-gaps.mjs` and `scripts/aa-new-models.mjs` all import from here.

// ":free", ":thinking", ":batch" — OpenRouter's separator for an operating point of the id in front
// of it. The base id is what the catalog tracks, so anything after a colon is already covered.
export const variantOf = (id: string) => id.includes(":");

// A service tier arrives in a shape `variantOf` cannot see: OpenRouter publishes
// `Claude Opus 5 (batch)` and `Claude Opus 5 (Fast)` as separate ids whose tier lives in the
// display name, not after a colon.
//
// The keyword list is closed and deliberately short, because the cost of a wrong entry here is a
// real model going unreported — a false negative nobody can see, which is the expensive direction.
// `preview` is NOT on it: the catalog carries `Gemini 3.1 Pro Preview` and `Qwen3.6 Max Preview` as
// records of their own, since a preview is different weights while a batch tier is the same weights
// at a different price. Nor are `lite`, `mini` or `flash` — those are models. Measured 2026-08-10,
// when five of the eight names in this section were `(batch)` or `(Fast)` and carried zero archived
// rows between them.
export const TIER_WORDS = new Set(["batch", "fast", "flex", "priority", "standard", "scale"]);

// Takes the display text, not the id: the tier is a trailing parenthetical. Asserted rather than
// described — `scripts/aa-new-models.mjs --self-test` replays 14 real strings through this function
// in CI, both directions, because a classifier that quietly widens stops reporting real models.
//
// The two callers apply it with different strictness, on purpose. The scripts can read the archive,
// so they require the keyword AND zero archived rows: a `(Fast)` row that turns out to carry
// evidence stays in the queue instead of vanishing into the tier line. The route runs at the edge
// with no archive, so it has the keyword alone. The asymmetry can only mis-hide a name from the
// site's fold; `npm run report:gaps` still surfaces it, which is the safe direction.
export const tierWordOf = (text: string | null | undefined) => {
  const match = /\(([^()]+)\)\s*$/.exec(String(text ?? ""));
  if (!match) return null;
  const word = match[1].trim().toLowerCase();
  return TIER_WORDS.has(word) ? word : null;
};
