# Interface and responsive contract

`docs/ARCHITECTURE.md` governs the data. This document governs everything between the data and
the screen: the type scale, the breakpoints, what the phone layout guarantees, and how to check a
change without trusting a screenshot that lies.

Read it before editing `app/globals.css`, before adding a control, and before "just bumping" a
font size — the sizes here are a scale, not local decisions.

## 1. What the UI is

One client component (`app/page.tsx`) rendering six stacked sections into a fixed rail:

```text
rail (nav)   workspace
  ⌁          header      brand · search · language · live price status
  ◇          brief       five snapshot cards
  △          01 ranking      lens tabs, filters, ranked rows, coverage footnote
  $          02 model-detail radar + coverage + model dossier
  ≡          03 benchmarks   axis tabs, line chart, raw score table
             04 pricing      per-model token economics
             05 catalog      68 benchmark cards, collapsed by default
             06 sources      connected / queued source cards
```

`NAV` in `page.tsx` is the single source for both the rail and the scroll-spy: adding a section
means adding one entry there and one `id` on the section, nothing else.

State lives in `Home`. Nothing is persisted except the language choice (`localStorage`,
`observatory-language`), applied after mount so the prerendered HTML stays static.

**Two things are deliberately resolved after mount for the same reason.** The page is prerendered,
so anything derived from the clock would make the server's HTML and the browser's disagree. The
source-card staleness cutoff (`staleBefore`) and the live price comparison both start empty and
fill in on the client. Until they land, no card is marked and no comparison is shown — an
unflagged card is a flag not yet computed, never a false reassurance.

## 2. Type scale

Every size in the stylesheet comes from one of two scales. Do not introduce a third value.

| Role | Desktop | Phone (≤800px) |
| --- | --- | --- |
| Page title | 24px | 20px |
| Section heading | 18px | 16px |
| Panel figure (KPI, coverage %) | 22–25px | 22–26px |
| Body / description | 11px | 11px |
| Table and control text | 9–11px | 10–12px |
| Mono labels, badges, footnotes | 8–10px | 9–10px |
| Table cell provenance tag | 7px | 7px |

Two rules hold the scale together:

1. **Nothing on a phone renders below 9px** except the provenance tag inside the score table,
   which is a secondary annotation on a cell whose number is already legible.
2. **Form controls on a phone are 16px.** iOS Safari zooms the whole page when a control smaller
   than that takes focus, and the page never zooms back. This is why `.search input` and
   `.filters select` look larger than their neighbours; it is deliberate.

Fonts. The interface is bilingual, and no self-hostable Latin webfont pairs convincingly with a
CJK fallback — Geist next to PingFang read as two unrelated typefaces. So prose uses **each
platform's own UI face** (`--sans`), which is designed alongside that platform's Chinese face: SF
Pro with PingFang SC on Apple, Roboto with Noto Sans SC on Android. The CJK families are named
explicitly rather than left to the generic fallback, which lands on Heiti and looks cheap.

**Geist Mono is the one webfont loaded** (`--mono`). It carries the numerals the whole layout is
built around. It also needs the CJK chain appended, because several mono labels are Chinese.

`--sans` and `--mono` are declared **on `body`**, not `:root`, because `next/font` puts
`--font-geist-mono` on the body class, and a custom property is substituted on the element that
declares it. Declaring them at `:root` silently resolves to the fallback.

## 3. Breakpoints

| Width | What changes |
| --- | --- |
| >1260px | Full layout: 72px rail, two-column detail grid, 4-up catalog, 5-up sources |
| ≤1260px | Ranking columns tighten; catalog and sources drop to 3-up |
| ≤1080px | Detail grid collapses to one column; KPIs go 4-up; catalog 2-up |
| ≤800px | Phone layout — see below |
| ≤380px | Small-phone trims: bottom-bar labels, snapshot card widths, tab padding |

There is no tablet-specific design. 800–1080px is the desktop layout compressed, and that is
intentional: the phone layout is a different information architecture, not a narrower one.

## 4. The phone contract (≤800px)

Six guarantees. A change that breaks one of them is a regression even if it looks fine.

1. **No horizontal document overflow.** `document.scrollWidth === clientWidth` at 320, 360, 390
   and 430px. Wide content lives inside a named scroller, never in the page.
2. **Every control is at least 44px tall.** Rail items are 56px; buttons, selects and the search
   are 44px. A segmented sub-button inside a 44px group (`中` / `EN`, `模型` / `系统`) may be
   shorter than its group but never below 36px.
3. **One horizontal scroller per row**, each with `overscroll-behavior-x: contain` so a swipe
   cannot chain into the browser's back gesture. The scrollers are: `.brief`, `.metric-tabs`,
   `.axis-tabs`, `.legend`, `.compare-pills`, `.price-strip`, `.chart-scroll`, `.score-table-wrap`.
4. **Nothing fixed without a safe-area pad.** The bottom rail pads with
   `env(safe-area-inset-bottom)` and `.shell` reserves `64px + inset`. The workspace pads its
   sides with `max(10px, env(safe-area-inset-*))` for landscape notches.
5. **Nothing absolutely positioned inside the header.** The header is static on a phone; the
   search sits in its own flow row. It used to be `position:absolute; top:72px` inside a sticky
   header, which meant it floated over the page permanently while scrolling.
6. **Nothing is sticky on a phone.** The header scrolls away, the lens toolbar scrolls away, and
   the bottom rail is the only fixed element. A pinned two-row toolbar cost a fifth of the screen
   for the length of the ranking list, and the lens is set once.
   If you ever do add a sticky element inside a panel, note that `.panel` uses `overflow:clip`
   rather than `overflow:hidden` for a reason: `hidden` makes the panel a scroll container, which
   silently confines a sticky child to a box that never scrolls.

Layout differences from desktop, beyond size:

- The rail becomes a five-item labelled bottom bar. Glyphs alone are unreadable at that size, so
  each item carries a bilingual label that desktop CSS hides.
- Section heads stack: the title on one row, its control full-width on the next. Two-option
  toggles (`.mode-switch`, `.mode-compact`) split the row instead of scrolling.
- Ranking rows become cards: rank, name, current lens value, then a `.mobile-metrics` strip
  carrying AA, Arena and the active lens. The six desktop metric columns are hidden, not shrunk.
- The score table pins its model column — body cells *and* the header cell above them, or the
  names read as a detached box once the table scrolls — and gains a swipe hint above it. That
  column is sticky inside `.score-table-wrap`, its own scroller, not against the viewport.

## 5. Performance rules

- **Derived scores are cached at module scope.** `BENCHMARKS`, `BENCHMARK_SCORES` and the axis
  taxonomy are constants — a live price refresh replaces model records but never a score — so
  `axisScore`, `coverageFor` and `axisCoverage` memoise on a string key. Before this, one
  scroll-driven re-render re-filtered the 68-benchmark list roughly 120 times. If you add a
  derived number, cache it the same way or explain why it cannot be.
- **The price poll respects visibility.** The five-minute interval only fires while
  `document.visibilityState === "visible"`, and returning to a backgrounded tab refetches only if
  the snapshot is older than the period. A phone keeps this tab alive for hours.
- **A loaded webfont must be referenced, and a referenced one must be loaded.** The stylesheet
  asked for Inter and IBM Plex Mono while `layout.tsx` loaded Geist Sans and Geist Mono: two
  families downloaded for nothing, and every mono label falling through to the platform default —
  Menlo on iOS, Droid Sans Mono on Android. Now only Geist Mono is loaded, and `--mono` is the
  only thing that references it.
- The client bundle is ~1.1MB raw / ~215KB gzipped, of which the observation archive is ~520KB
  raw but only ~36KB gzipped. It compresses well because source labels and URLs repeat; if parse
  time ever matters, dedupe them into a source table in `scripts/ingest.mjs` rather than trimming
  evidence.

## 6. Verifying a UI change

Headless Chrome **without device emulation ignores the viewport meta tag** and will show you
phantom overflow — a screenshot taken that way is not evidence. Emulate properly:

```bash
npm run build && PORT=3111 npm run start:next     # test the production build, not the dev server
npm run check:mobile                              # 320 / 390 / 430
node scripts/check-mobile.mjs http://localhost:3111/ 390 --shot=/tmp/shot.png
node scripts/check-mobile.mjs http://localhost:3111/ 1024 1440   # overflow only
```

`scripts/check-mobile.mjs` sets `Emulation.setDeviceMetricsOverride` with `mobile: true`, then
reports `scrollWidth` vs `clientWidth`, every element crossing the viewport edge that is *not*
inside a scroller, every rendered text node under 9px, and every control under 36px. Overflow
exits non-zero; the other two print as warnings. It is not in CI — it needs Chrome and a running
server — so run it when you touch the layout.

Then look at it on a real phone. Emulation gets layout right and gets touch, momentum scrolling,
dynamic toolbars and font rendering wrong.

## 7. Deliberate choices that look like bugs

- The live-price button shows `font-size: 0` on a phone: the dot and the state colour survive, the
  label does not. The same information is in the pricing section head.
- A price card can print two prices. The large one is the archived list price and is the number
  the dashboard stands behind; the small `≠ OpenRouter now …` line underneath is what the provider
  charges right now, shown only when the two disagree by more than 0.5%. It is not a correction
  waiting to be applied — see ARCHITECTURE §6.
- A source card prints `read <date>` or `evaluated <date>`, not both, and they mean different
  things: when this project last transcribed the source, versus when the newest published result
  was produced. Cards with no observation rows behind them (Arena, OpenRouter) keep the registry's
  hand-written label instead. Past `SOURCE_STALE_DAYS` the date turns amber with a `◷` — one card
  qualifies today, which is the intended volume.
- `maximum-scale` is 5, not 1. Pinch-zoom is the only way to read a dense score table on a phone
  and must not be disabled.
- The catalog is collapsed by default on every width. It is 68 cards; expanded, it is longer than
  the rest of the page combined.
- `.brief` scrolls horizontally on a phone rather than wrapping to a grid, so the navy leading
  card stays a fixed landmark at the left edge.
- The radar's viewBox (500×340) is much wider than its plot (236 across), because a seven-
  character axis label needs bleed on both sides. Desktop hides a tight box behind the fixed
  350px height, which letterboxes the SVG; a phone sets `height:auto`, so the box *is* the
  viewBox and any overhang is clipped. `多模态理解` used to render as `态理解`.
