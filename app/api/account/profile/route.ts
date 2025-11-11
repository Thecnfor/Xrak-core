// 兼容 Next 16 路由类型校验的占位文件（转发到统一 Hono 捕获路由）
// 实际逻辑在 `app/api/[...hono]/route.ts` 内，此文件仅复用其处理器以通过类型检查。

export const runtime = "nodejs";

export { POST } from "../../routeProxy";