import type { Metadata } from "next";
export const defaultMetadata: Metadata = {
  title: {
    default: "XRak",
    template: "%s | XRak",
  },
  description: "XRak 平台",
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "XRak",
    images: [],
  },
};
