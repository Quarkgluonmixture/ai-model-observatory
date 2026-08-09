// Reading a board out of an Astro page.
//
// Astro server-renders an interactive component's props into an HTML attribute:
//
//   <astro-island component-url="/_astro/BenchmarkView.…js" props="{&quot;benchmarkView&quot;:[0,{…}]}">
//
// So the data IS in the HTML, and every check that looks for a <table>, a `fetch(` or an `/api/`
// path still answers no — which is how Vals AI was recorded twice as publishing nothing
// machine-readable. Epoch's benchmark pages use the same framework and the same trick.
//
// The values are wrapped: Astro encodes each one as `[type, payload]` so it can round-trip Maps,
// Sets and Dates through an attribute. Reading `props.benchmarkView` without unwrapping gives
// `[0, {...}]` and every field lookup below it silently returns undefined.

/** Undo Astro's `[type, payload]` value wrapping, recursively. */
export const unwrapAstroProps = (value) => {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return unwrapAstroProps(value[1]);
  }
  if (Array.isArray(value)) return value.map(unwrapAstroProps);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrapAstroProps(item)]));
  }
  return value;
};

const unescapeAttribute = (text) => text
  .replaceAll("&quot;", '"')
  .replaceAll("&#34;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&apos;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  // Ampersand last: doing it first would turn `&amp;quot;` into a quote and break the JSON.
  .replaceAll("&amp;", "&");

/**
 * The parsed props of the largest `<astro-island>` whose props mention `key`.
 *
 * Largest, not first: a board page carries several islands (theme toggle, mailing list, the
 * selectors) and the one holding the leaderboard is the big one. Returns null when no island
 * matches, which callers should treat as a page restyle rather than as an empty board.
 */
export const readAstroIslandProps = (html, key) => {
  let best = null;
  for (const tag of html.match(/<astro-island\b[^>]*>/g) ?? []) {
    const attribute = /\bprops="([^"]*)"/.exec(tag);
    if (!attribute) continue;
    const raw = unescapeAttribute(attribute[1]);
    if (!raw.includes(`"${key}"`)) continue;
    if (best === null || raw.length > best.length) best = raw;
  }
  return best === null ? null : JSON.parse(best);
};
