// 服务端专用的 Redis 封装，基于官方 redis v4 客户端
import { readRedisEnv } from "./env";

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("Redis 服务仅允许在服务端/运行时使用");
  }
}

// 惰性导入，避免客户端打包
let _redis: typeof import("redis") | undefined;
async function ensureDeps() {
  if (!_redis) _redis = await import("redis");
}

type RedisClientType = import("redis").RedisClientType;

declare global {
  // Dev/HMR 单例，避免重复连接；为规避跨版本类型不兼容，这里使用 unknown
  var __redis_client__: unknown | undefined;
}

// 因 redis 客户端类型在不同打包上下文可能产生不兼容，这里返回 any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRedisClient(): Promise<any> {
  assertServer();
  await ensureDeps();

  if (global.__redis_client__) return global.__redis_client__;
  const cfg = readRedisEnv();
  const url = `redis://${cfg.host}:${cfg.port}`;
  const client = _redis!.createClient({ url, password: cfg.REDIS_PASSWORD || undefined });
  await client.connect();
  global.__redis_client__ = client;
  return client;
}

// 简单健康检查
export async function ping(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const res = await client.ping();
    return res.toLowerCase() === "pong";
  } catch {
    return false;
  }
}