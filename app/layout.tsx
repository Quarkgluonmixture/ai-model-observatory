import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

// Only the mono face is loaded. Prose uses the platform UI font so Latin and Chinese pair —
// see the type note in globals.css — and a webfont nobody references is a download for nothing.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Model Observatory · AI 模型观测站",
  description: "Bilingual frontier AI model rankings, benchmarks, capability radar charts, and token pricing.",
  other: {
    "codex-preview": "development",
  },
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
      </body>
    </html>
  );
}
