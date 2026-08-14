import type { Metadata } from "next";

// The observatory page is a client component, so it cannot export metadata itself.
// This layout carries the title that used to sit in the root layout, back when the
// observatory *was* the root route. The root is now the personal site.
// Two sites live in this repository — the personal site at `/` and the observatory at `/models` —
// and until now they shared one tab icon, because the root layout declared `icons` and nothing
// overrode it. The tab is the one place a reader sees both at once, so it is the one place the two
// identities have to be told apart.
//
// Next.js merges metadata per FIELD, not per key inside a field: declaring `icons` here replaces
// the root's `icons` wholesale rather than adding to it, which is why both entries are repeated.
// Asserted after `next build` by reading the prerendered HTML of both routes — the question is not
// "is the file there" but "did the right href reach each route".
//
// The artwork is hand-written SVG, and the reason is a measurement rather than a preference: a
// favicon's real size is 16px, and at 16px a 3×3 grid is one dark smudge — each cell lands on about
// 2 pixels. So the observatory mark is 2×2 (~5px per cell), with the fourth cell outlined instead of
// filled, which is the only part that carries the "partial coverage" idea. An image model produced a
// 3×3 version twice, once as a raster and once traced to vector; both are legible at 32px and mush
// at 16. Vector also lets the small end be tuned at all — no stroke here is thinner than 2.2 units
// on a 32 viewBox, so nothing disappears when the browser scales it down.
//
// Source artwork for both marks is archived under `docs/assets/icons/`. The name is the only
// contract, so replacing the file needs no edit here.
export const metadata: Metadata = {
  title: "AI Model Observatory · AI 模型观测站",
  description:
    "Bilingual frontier AI model rankings, benchmarks, capability radar charts, and token pricing.",
  icons: {
    icon: "/favicon-models.svg",
    shortcut: "/favicon-models.svg",
  },
};

export default function ModelsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
