// next-sitemap 配置：用于自动生成 sitemap/robots，结合 CI 运行
// 说明：站点地址通过环境变量 NEXT_PUBLIC_SITE_URL 控制，避免硬编码

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  generateRobotsTxt: true,
  // 排除开发与内部页面路径
  exclude: ['/dev', '/api/*'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: ['/dev', '/api'] },
    ],
  },
};