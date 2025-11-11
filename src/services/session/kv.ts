// KV 会话封装（优先使用自建 Redis，缺失时降级为内存 Map）
// 说明：统一读写会话上下文，供 SessionRoot 挂载；生产环境请配置 Redis。

import type { SessionContext } from "@src/types/session";
import { generateCsrfSecret } from "../../utils/csrf";

type KVImpl = {
  get: (key: string) => Promise<SessionContext | null>;
  set: (key: string, value: SessionContext, ttlSec?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
};

let impl: KVImpl | null = null;
// 全局强制内存降级标记：当 Redis 连接失败时置位，避免后续再次尝试连接导致阻塞
const gAny = globalThis as unknown as { __xrak_kv_force_memory__?: boolean };

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("KV 会话服务仅允许在服务端/运行时使用");
  }
}

function getMemoryStore(): Map<string, SessionContext> {
  // 通过 globalThis 共享 Map，避免在 Next Dev 环境下不同路由/模块上下文不共享导致会话读取不到。
  const g = globalThis as unknown as {
    __xrak_kv_store?: Map<string, SessionContext>;
  };
  if (!g.__xrak_kv_store) {
    g.__xrak_kv_store = new Map<string, SessionContext>();
  }
  return g.__xrak_kv_store;
}

function getImpl(): KVImpl {
  assertServer();
  if (impl) return impl;

  // 优先使用 Redis（通过 REDIS_* 环境变量判定）
  const hasRedisEnv = !!process.env.REDIS_REMOTE_HOST || !!process.env.REDIS_LOCAL_HOST;
  if (hasRedisEnv && !gAny.__xrak_kv_force_memory__) {
    const redisPromise = import("../db/redis");
    // 构造带降级的 Redis 实现：任何调用失败时切换到内存存储
    impl = {
      async get(key) {
        try {
          const { getRedisClient } = await redisPromise;
          const client = await getRedisClient();
          const raw = await client.get(key);
          return raw ? (JSON.parse(raw) as SessionContext) : null;
        } catch {
          gAny.__xrak_kv_force_memory__ = true;
          const store = getMemoryStore();
          return store.get(key) ?? null;
        }
      },
      async set(key, value, ttlSec) {
        try {
          const { getRedisClient } = await redisPromise;
          const client = await getRedisClient();
          const data = JSON.stringify(value);
          if (ttlSec && ttlSec > 0) {
            await client.set(key, data, { EX: ttlSec });
          } else {
            await client.set(key, data);
          }
        } catch {
          gAny.__xrak_kv_force_memory__ = true;
          const store = getMemoryStore();
          store.set(key, value);
        }
      },
      async del(key) {
        try {
          const { getRedisClient } = await redisPromise;
          const client = await getRedisClient();
          await client.del(key);
        } catch {
          gAny.__xrak_kv_force_memory__ = true;
          const store = getMemoryStore();
          store.delete(key);
        }
      },
    };
    return impl;
  }

  // 内存降级（仅本地临时测试用）
  const store = getMemoryStore();
  impl = {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async del(key) {
      store.delete(key);
    },
  };
  return impl;
}

export async function getSession(sid: string): Promise<SessionContext | null> {
  const ctx = await getImpl().get(`sess:${sid}`);
  // 读取时进行过期校验，避免脏数据长期滞留
  if (ctx && typeof ctx.expiresAt === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (now >= ctx.expiresAt) {
      // 过期即清除并同步索引
      await deleteSession(sid);
      return null;
    }
  }
  return ctx;
}

// 内部：获取是否启用真实 KV
function hasRealKV(): boolean {
  // 使用 Redis 作为真实 KV 后端，且未被强制降级为内存
  const configured = !!process.env.REDIS_REMOTE_HOST || !!process.env.REDIS_LOCAL_HOST;
  const forcedMemory = !!gAny.__xrak_kv_force_memory__;
  return configured && !forcedMemory;
}

// 内存索引（userId -> Set<sid>），在本地降级场景使用
function getMemoryUserIndex(): Map<number, Set<string>> {
  const g = globalThis as unknown as {
    __xrak_kv_user_index?: Map<number, Set<string>>;
  };
  if (!g.__xrak_kv_user_index) {
    g.__xrak_kv_user_index = new Map<number, Set<string>>();
  }
  return g.__xrak_kv_user_index;
}

// 辅助：写入用户索引
async function addUserIndex(userId: number, sid: string): Promise<void> {
  if (userId <= 0) return; // 匿名会话不入索引
  if (hasRealKV()) {
    try {
      const { getRedisClient } = await import("../db/redis");
      const client = await getRedisClient();
      await client.sAdd(`sessidx:user:${userId}`, sid);
      return;
    } catch {
      // Redis 不可用时降级到内存索引
    }
  } else {
    const idx = getMemoryUserIndex();
    const set = idx.get(userId) ?? new Set<string>();
    set.add(sid);
    idx.set(userId, set);
  }
  // 降级写入（Redis 不可用或未配置）
  const idx = getMemoryUserIndex();
  const set = idx.get(userId) ?? new Set<string>();
  set.add(sid);
  idx.set(userId, set);
}

// 辅助：移除用户索引
async function removeUserIndex(userId: number, sid: string): Promise<void> {
  if (userId <= 0) return;
  if (hasRealKV()) {
    try {
      const { getRedisClient } = await import("../db/redis");
      const client = await getRedisClient();
      await client.sRem(`sessidx:user:${userId}`, sid);
      return;
    } catch {
      // Redis 不可用时降级到内存索引
    }
  } else {
    const idx = getMemoryUserIndex();
    const set = idx.get(userId);
    if (set) {
      set.delete(sid);
      if (set.size === 0) idx.delete(userId);
    }
  }
  // 降级写入（Redis 不可用或未配置）
  const idx = getMemoryUserIndex();
  const set = idx.get(userId);
  if (set) {
    set.delete(sid);
    if (set.size === 0) idx.delete(userId);
  }
}

export async function setSession(
  sid: string,
  ctx: SessionContext,
  ttlSec?: number
): Promise<void> {
  // 统一在服务端补充安全与时间字段
  const now = Math.floor(Date.now() / 1000);
  const expiresAt =
    typeof ttlSec === "number" && ttlSec > 0 ? now + ttlSec : ctx.expiresAt;
  const toSave: SessionContext = {
    ...ctx,
    csrfSecret: ctx.csrfSecret ?? generateCsrfSecret(),
    issuedAt: ctx.issuedAt ?? now,
    expiresAt: expiresAt,
  };
  await getImpl().set(`sess:${sid}`, toSave, ttlSec);
  // 维护用户会话索引（多设备登录管理）
  await addUserIndex(toSave.userId, sid);
}

export async function deleteSession(sid: string): Promise<void> {
  // 删除前尝试读取以便同步索引
  try {
    const existing = await getSession(sid);
    await getImpl().del(`sess:${sid}`);
    if (existing) {
      await removeUserIndex(existing.userId, sid);
    }
  } catch {
    await getImpl().del(`sess:${sid}`);
  }
}

// 列出用户的会话 ID（设备列表基础）
export async function listUserSessionIds(userId: number): Promise<string[]> {
  if (userId <= 0) return [];
  if (hasRealKV()) {
    try {
      const { getRedisClient } = await import("../db/redis");
      const client = await getRedisClient();
      const ids = await client.sMembers(`sessidx:user:${userId}`);
      return Array.isArray(ids) ? (ids as string[]) : [];
    } catch {
      // Redis 不可用时降级到内存索引
    }
  }
  const idx = getMemoryUserIndex();
  return Array.from(idx.get(userId) ?? new Set<string>());
}

// 列出用户的详细会话（包含上下文）
export async function listUserSessions(
  userId: number
): Promise<Array<{ sid: string; ctx: SessionContext | null }>> {
  const ids = await listUserSessionIds(userId);
  // 并行化读取会话上下文，提升设备列表性能
  const results = await Promise.all(
    ids.map(async (sid) => ({ sid, ctx: await getSession(sid) }))
  );
  return results;
}
