import type { Metadata } from "next";

// The observatory page is a client component, so it cannot export metadata itself.
// This layout carries the title that used to sit in the root layout, back when the
// observatory *was* the root route. The root is now the personal site.
export const metadata: Metadata = {
  title: "AI Model Observatory · AI 模型观测站",
  description:
    "Bilingual frontier AI model rankings, benchmarks, capability radar charts, and token pricing.",
};

export default function ModelsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
