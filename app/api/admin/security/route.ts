// 兼容 Next 16 路由类型校验的占位文件（转发到统一 Hono 捕获路由）
// 管理安全相关路由由 `app/api/[...hono]/route.ts` 统一处理，此处仅复用导出。

export const runtime = "nodejs";

export { GET, POST, PUT } from "../../routeProxy";