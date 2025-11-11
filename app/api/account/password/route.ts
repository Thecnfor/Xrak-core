// 兼容 Next 16 路由类型校验的占位文件（转发到统一 Hono 捕获路由）
// 说明：实际处理逻辑位于 `app/api/[...hono]/route.ts`，此处仅复用其导出的处理器，
// 以满足构建期间对 `app/api/account/password/route.ts` 的类型存在性检查。

export const runtime = "nodejs";

export { POST } from "../../routeProxy";