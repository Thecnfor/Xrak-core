import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { composeMetadata } from "../lib/utils/seo";
import "./globals.css";
import "./styles/animate.css";
import "./styles/components.css";
import "./styles/tokens.css";

//  Geist 字体
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceHanSansSC = localFont({
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
  variable: "--font-source-han-sans-sc",
  display: "swap",
  preload: true,
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "Noto Sans CJK SC",
    "Noto Sans",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
});

// 元数据
export const metadata: Metadata = composeMetadata();

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${sourceHanSansSC.className} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
