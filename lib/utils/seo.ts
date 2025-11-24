import type { Metadata } from "next";

const siteName = "XRak";
const siteDescription = "XRak 平台";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function composeMetadata(overrides: Partial<Metadata> = {}): Metadata {
  return {
    title: siteName,
    description: siteDescription,
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: "website",
      siteName,
      title: siteName,
      description: siteDescription,
      url: siteUrl,
      ...(overrides.openGraph || {}),
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description: siteDescription,
      ...(overrides.twitter || {}),
    },
    ...overrides,
  };
}

