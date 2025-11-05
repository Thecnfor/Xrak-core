import type { Metadata } from "next";
import type { MetadataRoute } from "next";
import { defaultSEOConfig, generatePageMetadata } from "../../src/utils/seo/seo";

// 示例：静态页面 generateMetadata（首页）
export const generateMetadataHome = (): Metadata =>
  generatePageMetadata(defaultSEOConfig, {
    title: "首页",
    description: "欢迎来到 Xrak",
    path: "/",
    locale: "zh-CN",
  });

// 示例：动态路由页面 generateMetadata（产品详情）
export function generateMetadataProduct({
  params,
}: {
  params: { slug: string; locale?: "zh-CN" | "en" };
}): Metadata {
  const { slug, locale = "zh-CN" } = params;
  return generatePageMetadata(defaultSEOConfig, {
    title: `产品 · ${slug}`,
    description: `查看产品 ${slug} 的详细信息`,
    path: `/products/${slug}`,
    locale,
    images: [
      `${defaultSEOConfig.siteUrl}/og/products/${encodeURIComponent(slug)}.png`,
    ],
  });
}

// robots.txt 路由模板（示例）
export function robotsTemplate(): MetadataRoute.Robots {
  const base = defaultSEOConfig.siteUrl;
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: [`${base}/sitemap.xml`],
    host: base,
  };
}

// sitemap.xml 路由模板（示例）
export function sitemapTemplate(): MetadataRoute.Sitemap {
  const base = defaultSEOConfig.siteUrl;
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/products`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}

// 结构化数据（JSON-LD）示例：面包屑
export function getBreadcrumbJsonLd(paths: string[]) {
  const base = defaultSEOConfig.siteUrl;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: paths.map((p, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: p.split("/").filter(Boolean).slice(-1)[0] || "home",
      item: `${base}${p}`,
    })),
  };
}

// SEO 最佳实践说明（用于阅读理解，非运行代码）：
// - 合理 URL：使用单一 canonical 与语言 alternates（见 generatePageMetadata）。
// - 规范链接：robots 允许抓取，sitemap 提供主要入口（见模板）。
// - 加载速度：使用 next/font 与按需权重、display swap、预加载关键字体（见布局）。
// - 移动适配：viewport 使用 device-width 与合适初始缩放（见生成器）。
// - 结构化数据：示例 JSON-LD 面包屑，可在 head.tsx 或页面组件中注入。