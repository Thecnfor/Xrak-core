// 数据库/缓存服务层统一导出入口：仅封装连接与健康检查，不包含业务逻辑
// 说明：在 Server 组件或 API 路由中通过服务层访问数据库，禁止在客户端直接连接。
export * from "./env";
export * from "./mongo";
export { getMySQLPool, getDrizzle } from "./mysql";
export { getRedisClient } from "./redis";
// 为避免重复导出冲突，分别对 ping 进行别名导出
export { ping as mysqlPing } from "./mysql";
export { ping as redisPing } from "./redis";