import type { Metadata } from "next";

export type Locale = "zh-CN" | "en" | "ja" | "ko";

export interface BaseSEOConfig {
  siteName: string;
  siteUrl: string; // absolute base URL
  defaultLocale: Locale;
  locales: Locale[];
  twitter?: {
    site?: string;
    creator?: string;
  };
}

export interface PageSEOInput {
  title?: string;
  description?: string;
  path?: string; // e.g. "/products/slug"
  locale?: Locale;
  images?: string[]; // absolute URLs
  noindex?: boolean;
  canonical?: string; // override canonical
}

export const defaultSEOConfig: BaseSEOConfig = {
  siteName: "Xrak",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  defaultLocale: "zh-CN",
  locales: ["zh-CN", "en"],
  twitter: {
    site: "@xrak",
    creator: "@xrak",
  },
};

function getAbsoluteUrl(base: string, path?: string) {
  try {
    const url = new URL(path ?? "/", base);
    return url.toString();
  } catch {
    return `${base}${path ?? "/"}`;
  }
}

export function generatePageMetadata(
  config: BaseSEOConfig,
  input: PageSEOInput = {}
): Metadata {
  const base = config.siteUrl;
  const locale = input.locale ?? config.defaultLocale;
  const url = input.canonical ?? getAbsoluteUrl(base, input.path);

  const title = input.title ?? config.siteName;
  const description = input.description ?? `${config.siteName} - ${locale}`;

  const images = (input.images ?? []).map((i) => ({ url: i }));

  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        config.locales.map((l) => [l, getAbsoluteUrl(base, input.path)])
      ),
    },
    robots: input.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: config.siteName,
      url,
      title,
      description,
      locale,
      images,
    },
    twitter: {
      card: "summary_large_image",
      site: config.twitter?.site,
      creator: config.twitter?.creator,
      title,
      description,
      images: input.images,
    },
    applicationName: config.siteName,
    category: "technology",
  };
}

export const defaultPageMetadata: Metadata = generatePageMetadata(
  defaultSEOConfig,
  {}
);