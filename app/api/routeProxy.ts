// 统一 API 路由代理：复用捕获路由的导出，减少重复代码
// 说明：各子路由占位文件仅需从此处转发 GET/POST/PUT，
// 实际处理逻辑位于 `app/api/[...hono]/route.ts`。

export { GET, POST, PUT } from "./[...hono]/route";