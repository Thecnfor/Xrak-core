import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import AppProviders from "@client/providers/AppProviders";
import { getInitialPrefs } from "@features/prefs/server/prefs";
import { Suspense } from "react";
import { Toaster } from "@features/toaster/Toaster";
import { defaultMetadata } from "@core/config/seo";
export const runtime = "nodejs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceHanSans = localFont({
  variable: "--font-cn-sans",
  src: [
    {
      path: "../public/fonts/harmonyos-sans/SourceHanSansSC-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/harmonyos-sans/SourceHanSansSC-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/harmonyos-sans/SourceHanSansSC-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/harmonyos-sans/SourceHanSansSC-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  fallback: [
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "Noto Sans CJK SC",
    "system-ui",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  preload: true,
});

export const metadata: Metadata = defaultMetadata;
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sourceHanSans.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <ServerProviders>
            {children}
          </ServerProviders>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}

async function ServerProviders({ children }: { children: React.ReactNode }) {
  const initialPrefs = await getInitialPrefs();
  return <AppProviders initialPrefs={initialPrefs}>{children}</AppProviders>;
}
