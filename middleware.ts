// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 示例：如果访问 /dashboard 且没有 token，重定向到首页
  const token = request.cookies.get("token");

  if (request.nextUrl.pathname.startsWith("/dashboard") && !token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// 配置匹配路径，避免对静态资源运行中间件（很重要！）
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了以这些开头的：
     * - api (API 路由)
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (图标)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
