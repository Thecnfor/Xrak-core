import type { Metadata, ResolvingMetadata } from "next";
import { headers } from "next/headers";

/**
 * 站点级 SEO 配置（可按需替换）
 * - siteName: 站点名称（用于 title 模板、OG/Twitter）
 * - siteDescription: 站点默认描述
 * - siteUrl: 站点根域名（优先取 NEXT_PUBLIC_SITE_URL），作为 canonical 与 metadataBase
 * - defaultOgImage: OpenGraph/Twitter 默认分享图
 */
const siteName = "XRak";
const siteDescription = "XRak 平台";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const defaultOgImage = "/og.png";

/**
 * 渲染策略类型说明
 * - SSR: 服务端每次请求渲染（动态）
 * - ISR: 增量静态再生成（静态 + 过期后后台再生成）
 * - SSG: 纯静态生成（构建时确定）
 * - CSR: 客户端渲染（数据与视图在浏览器侧）
 */
export type RenderStrategy = "SSR" | "ISR" | "SSG" | "CSR";

/**
 * composeMetadata 选项
 * - strategy: 指定页面渲染策略，便于控制 canonical、robots 等细节
 * - pathname: 当前页面相对路径，用于生成 canonical（例如 "/docs"）
 * - useRequestBase: 在 SSR/ISR 下根据请求头动态推断域名与协议
 * - locale: 语言，影响 openGraph.locale 与 alternates.languages
 * - revalidateSeconds: ISR 的再验证秒数（供导出常量时使用）
 */
export interface ComposeOptions {
  pathname?: string;
  useRequestBase?: boolean;
  locale?: string;
  baseUrl?: string;
}

/**
 * 根据 base 与 pathname 生成绝对 URL
 */
function buildAbsoluteUrl(base: string, pathname?: string): string {
  if (!pathname) return base;
  try {
    return new URL(pathname, base).toString();
  } catch {
    return `${base}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
  }
}

/**
 * 为 App Router 提供统一的 Metadata 组合器
 * - 默认提供站点级 title 模板、OpenGraph、Twitter、Robots、Alternates、Icons、Viewport、ThemeColor
 * - 通过 overrides 进行增量覆盖
 * - 通过 options 控制与渲染策略相关的细节
 */
export function composeMetadata(
  overrides: Partial<Metadata> = {},
  options: ComposeOptions = {}
): Metadata {
  const locale = options.locale || "zh-CN";
  const base = options.baseUrl || siteUrl;
  const canonical = buildAbsoluteUrl(base, options.pathname);

  const isProd = process.env.NODE_ENV === "production";
  const allowIndex = isProd; // 非生产环境默认不索引

  return {
    // 标题提供模板：页面标题 · 站点名
    title: {
      default: siteName,
      template: `%s · ${siteName}`,
    },

    description: siteDescription,

    // 基准域名，Next 会据此解析相对链接（如 alternates.canonical）
    metadataBase: new URL(base),

    // 关键词与应用信息
    keywords: [siteName, "平台", "XRak"],
    applicationName: siteName,
    creator: siteName,
    publisher: siteName,

    // 站点级图标（按需替换真实路径）
    icons: {
      icon: [
        { url: "./favicon.ico" },
        { url: "./favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "./favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: [{ url: "./apple-touch-icon.png" }],
      shortcut: [{ url: "./favicon.ico" }],
    },

    // SEO 索引策略：非生产默认 noindex，以避免测试环境被抓取
    robots: {
      index: allowIndex,
      follow: allowIndex,
      googleBot: {
        index: allowIndex,
        follow: allowIndex,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },

    // Canonical 与多语言（按需扩展 language map）
    alternates: {
      canonical,
      languages: {
        [locale]: canonical,
      },
    },

    // OpenGraph：默认 website + 分享图
    openGraph: {
      type: "website",
      siteName,
      title: overrides.title || siteName,
      description: overrides.description || siteDescription,
      url: canonical,
      locale,
      images: [
        {
          url: defaultOgImage,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
      ...(overrides.openGraph || {}),
    },

    // Twitter：大卡片，沿用 OG 图
    twitter: {
      card: "summary_large_image",
      title: overrides.title || siteName,
      description: overrides.description || siteDescription,
      images: [defaultOgImage],
      ...(overrides.twitter || {}),
    },

    // Manifest（若存在）
    manifest: "/site.webmanifest",

    // 允许调用方覆盖所有字段（最后应用）
    ...overrides,
  };
}

/**
 * 为 App Router 提供 generateMetadata 辅助工厂
 * 使用：
 * export const generateMetadata = makeGenerateMetadata("ISR", async (params, searchParams) => ({
 *   title: `文章 · ${params.slug}`,
 *   description: "文章详情",
 * }), { pathname: `/posts/${params.slug}`, useRequestBase: true, revalidateSeconds: 120 });
 */
export function makeGenerateMetadata(
  generator?: (
    params: Record<string, string>,
    searchParams: Record<string, string | string[]>,
    parent: ResolvingMetadata
  ) => Promise<Partial<Metadata>> | Partial<Metadata>,
  baseOptions: ComposeOptions = {}
) {
  return async (
    params: Record<string, string>,
    searchParams: Record<string, string | string[]>,
    parent: ResolvingMetadata
  ): Promise<Metadata> => {
    const overrides = generator
      ? await generator(params, searchParams, parent)
      : {};

    let base = baseOptions.baseUrl || siteUrl;
    if (baseOptions.useRequestBase) {
      try {
        const h = await headers();
        const proto = h.get("x-forwarded-proto") || "https";
        const host = h.get("x-forwarded-host") || h.get("host");
        if (host) base = `${proto}://${host}`;
      } catch {}
    }

    return composeMetadata(overrides, { ...baseOptions, baseUrl: base });
  };
}
