// A vendor's PRODUCT TIER that spells like a reasoning effort.
//
// Artificial Analysis suffixes the operating point onto its slug — `claude-opus-5-xhigh`,
// `gpt-5-6-sol-high` — and both AA fetchers split that suffix off into `effort`, which is the key
// `check:models` buckets on and the key the cross-source disagreement gate groups on.
//
// Alibaba breaks that convention. `Max` is not an operating point of Qwen3.8; it is the product,
// the way `Plus` and `Turbo` are. AA still writes it in the same slug position, so the split turned
// `qwen3-8-max` into model `qwen3-8` + effort `max`, and rule 7 says the catalog holds one record
// per family with effort on the row — so the catalog's family IS `qwen3.8-max` with no effort.
// Neither side is wrong about its own convention; they disagree about what the token means.
//
// What that cost, measured 2026-08-11 before this list existed: four parameter rows and six
// observation rows resolved to nothing. `check-model-provenance.mjs` skips a row it cannot
// resolve, so "321/321 backed, 0 contradictions" was true and `qwen3.8-max` was still the only
// all-null record in the catalog, while `qwen3.7-max` published a cost of 1.28 that AA had since
// re-measured at 0.5413. Nothing failed, because nothing could see the rows.
//
// ## Why an alias could not fix it
//
// An alias maps a model string to a catalog id. It does not change the row's `effort`, and the
// audit buckets on `modelId|effort`: the row would land in the `|max` bucket while the catalog
// configuration sits in `|null`, still invisible to the value it is supposed to back. And `max`
// is a REAL effort on `claude-opus-5` and `gpt-5.6-sol`, so a blanket "fold max into the family"
// would corrupt those. The distinction has to be made per vendor, before the split, which is here.
//
// ## Why a prefix and not a list of stems
//
// A list of stems (`qwen3-6`, `qwen3-7`, `qwen3-8`) goes stale the day Alibaba ships the next
// flagship, and it goes stale silently — the new model would simply be missing again, which is
// exactly the failure this exists to end. The rule is a property of the vendor's naming, so it is
// keyed on the vendor's slug prefix. It stays closed in the dimension that matters: only these
// (prefix, token) pairs are exempt, and every other `-max` slug still splits.
//
// If Alibaba ever does publish a genuine `max` effort alongside the Max tier, AA would carry two
// slugs collapsing to one cell, and the one-source-one-cell gate fails on exactly that — the
// backstop is already in place, and it fails loudly rather than merging.
const PRODUCT_TIERS = [
  {
    // Matches `qwen3-8-max`, `qwen3-7-max`, `qwen3-6-max`, `qwen3-max`, `qwen-2-5-max`.
    // Anchored at the start so `deepseek-r1-distill-qwen-1-5b` and friends are untouched.
    prefix: "qwen",
    tokens: ["max"],
    reason:
      "Alibaba sells Qwen Max/Plus/Turbo as product tiers, not operating points. The catalog's " +
      "family id already carries the tier (qwen3.8-max), so splitting it off leaves the row " +
      "pointing at a family that does not exist.",
  },
];

/**
 * True when `token` is this vendor's product tier rather than an operating point, and the slug
 * must therefore keep it. Callers apply this BEFORE their effort split.
 */
export const isProductTier = (slug, token) =>
  PRODUCT_TIERS.some((tier) => slug.startsWith(`${tier.prefix}`) && tier.tokens.includes(token));

export { PRODUCT_TIERS };
