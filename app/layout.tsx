import type { Metadata } from "next";
import "../src/observability/otel";
import { ObservabilityProvider } from "../src/observability/Provider";
import AppProviders from "../src/lib/providers/AppProviders";
import { Suspense } from "react";
import { Toaster } from "../src/features/toaster/Toaster";
import SessionRoot from "../src/lib/providers/SessionRoot";
import { Noto_Sans_SC, Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const notoSansSCExtra = Noto_Sans_SC({
  variable: "--font-noto-sans-sc-extra",
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  adjustFontFallback: true,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const sourceHanSansSC = localFont({
  variable: "--font-source-han-sans-sc",
  src: [
    {
      path: "../public/fonts/harmonyos-sans/SourceHanSansSC-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  preload: true,
  display: "swap",
  adjustFontFallback: false,
});

const sourceHanSansSCExtra = localFont({
  variable: "--font-source-han-sans-sc-extra",
  src: [
    {
      path: "../public/fonts/harmonyos-sans/SourceHanSansSC-Light.woff2",
      weight: "300",
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
  preload: false,
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Xrak",
    template: "%s · Xrak",
  },
  description: "Xrak — Edge-first, Serverless, AI-native",
  applicationName: "Xrak",
  generator: "Next.js",
  keywords: ["Next.js", "Edge", "Serverless", "AI-native", "TurboRepo"],
  authors: [{ name: "Xrak Team" }],
  creator: "Xrak",
  publisher: "Xrak",
  alternates: {
    canonical: "/",
    languages: {
      "zh-CN": "/zh-CN",
      en: "/en",
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "Xrak",
    title: "Xrak",
    description: "Edge-first, Serverless, AI-native",
    locale: "zh-CN",
    url: "/",
    images: [],
  },
  twitter: {
    card: "summary_large_image",
    site: "@xrak",
    creator: "@xrak",
    title: "Xrak",
    description: "Edge-first, Serverless, AI-native",
    images: [],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} ${notoSansSCExtra.variable} ${sourceHanSansSC.variable} ${sourceHanSansSCExtra.variable} antialiased`}
      >
        {/* 可观测性提供者：负责链路追踪、日志、指标等 */}
        <ObservabilityProvider>
          {/* 会话根：将 cookies+session 注入到客户端上下文 */}
          <SessionRoot>
            {/* 懒加载边界：防止 SSR 时阻塞，fallback 为空 */}
            <Suspense fallback={null}>
              {/* 全局业务提供者：统一收容主题、查询、吐司、SEO 与分析 */}
              <AppProviders locale="zh-CN">{children}</AppProviders>
            </Suspense>
            {/* 全局通知吐司：悬浮提示消息 */}
            <Toaster />
          </SessionRoot>
        </ObservabilityProvider>
      </body>
    </html>
  );
}
