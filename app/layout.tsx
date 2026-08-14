import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteBeian from "./site-beian";

// Only the mono face is loaded. Prose uses the platform UI font so Latin and Chinese pair —
// see the type note in globals.css — and a webfont nobody references is a download for nothing.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The root route is the personal site; the observatory lives at /models and carries its own
// title via app/models/layout.tsx. Keep this generic — it is the default for every route.
export const metadata: Metadata = {
  title: "Jiaming Wei — LLM 评测 · 红队 · Agent 安全",
  description: "LLM 评测与红队测试的作品集:判官保真度、agent 工具安全、可复现的实验系统。",
  other: {
    "codex-preview": "development",
  },
  // The mark is a Q for quarkspace: a ring with a gap, plus a tail with a gold nib. `/models`
  // overrides this with its own icon — see the note there for why the two are told apart.
  //
  // It is drawn for 16px, and the first attempt was not. Thickening the artwork's strokes was the
  // obvious fix and it was the wrong one: the real problem was that the mark occupied 53% of its
  // canvas, so a 16px tab spent half its pixels on a paper plate that is invisible against a light
  // tab bar. Measured in a real Chrome tab: 26/256 dark pixels, against 44/256 for the observatory
  // icon beside it. Filling the canvas — ring radius 45% → 60% of the width — puts it at 67/256.
  //
  // The crosshair ticks and the centre sparkle are gone, and that is the deliberate part. At 16px
  // they were not detail, they were four gold specks muddying the inside of the ring; a tick 24
  // units wide on a 1254 canvas renders 0.31px and no weight fixes that. What survives is what
  // still reads at 16px: the gap that makes the ring a Q, the tail, and one accent on its nib. The
  // full detailed artwork is archived under `docs/assets/icons/`.
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

// viewportFit=cover lets the fixed bottom rail sit under the home indicator and pad itself
// back with env(safe-area-inset-bottom). maximumScale stays above 1: pinch-zoom is the only
// way to read a dense score table on a phone, so it must not be disabled.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f4f3ee",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistMono.variable} antialiased`}
      >
        {children}
        {/* Every route gets the ICP filing, including any added after this line was written. */}
        <SiteBeian />
      </body>
    </html>
  );
}
