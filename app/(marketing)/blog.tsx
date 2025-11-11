// 营销页：Blog 主页（示例内容），采用集中式 SEO 工具生成 Metadata
// 说明：仅作为模板页，内容可替换；保持 generateMetadata 与 src/utils/seo.ts 一致风格

import type { Metadata } from "next";
import { generatePageMetadata, defaultSEOConfig } from "@src/utils/seo";

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  return generatePageMetadata(defaultSEOConfig, {
    title: "博客 | Xrak",
    description: "最新文章、发布与技术洞察",
    path: "/blog",
    images: [
      `${defaultSEOConfig.siteUrl}/og/blog.png`,
    ],
  });
}

export default function BlogPage() {
  // 服务器组件：简单内容占位，后续接入 CMS 渲染
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">博客</h1>
      <p className="mt-3 text-sm text-neutral-600">这里将展示最新文章与产品更新。</p>
    </main>
  );
}