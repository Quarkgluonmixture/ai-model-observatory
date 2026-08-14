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
// Swapping in a PNG is a one-line change on each side: point at `/favicon-models.png` and drop the
// file in `public/`. The name is the only contract.
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
