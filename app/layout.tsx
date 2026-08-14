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
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
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
