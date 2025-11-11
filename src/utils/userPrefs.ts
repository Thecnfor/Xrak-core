// 用户偏好设置工具：提供读写与缓存编排
// 约定：
// - 真实存储在 MySQL 的 user_preferences（Drizzle schema），字段 value_json 存 JSON 字符串
// - 旁路缓存在 Redis：key 形如 user:prefs:<userId> 或 user:prefs:<userId>:<namespace>
// - 仅在用户已登录且服务端（Server Components 或 API 路由）环境中写入；客户端只发起调用

import { getDrizzle } from "@src/services/db/mysql"; // 统一的数据库服务封装（mysql2 + drizzle-orm）
import { auth } from "@/drizzle/auth";
import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
// Redis 客户端采用动态导入，避免在缺失模块时构建失败
async function getRedisClientSafe(): Promise<any | null> {
  try {
    // 按项目约定，该模块应导出 getRedisClient()
    const mod: any = await import("@/src/services/db/redis");
    if (mod && typeof mod.getRedisClient === "function") return mod.getRedisClient();
    return null;
  } catch {
    return null;
  }
}

type UserPreferenceRow = InferSelectModel<typeof auth.userPreferences>;

// 规范化 key，避免大小写与空白问题
function normalizeKey(input: string): string {
  return input.trim().toLowerCase();
}

// 从 Redis 读取命名空间缓存（命中则返回）
async function readNamespaceCache(userId: number, namespace: string): Promise<Record<string, unknown> | null> {
  try {
    const getClient = await getRedisClientSafe();
    if (!getClient) return null;
    const client = await getClient();
    const key = `user:prefs:${userId}:${namespace}`;
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 将命名空间偏好写入 Redis，默认 1 小时 TTL
async function writeNamespaceCache(userId: number, namespace: string, data: Record<string, unknown>, ttlSeconds = 3600) {
  try {
    const getClient = await getRedisClientSafe();
    if (!getClient) return;
    const client = await getClient();
    const key = `user:prefs:${userId}:${namespace}`;
    await client.set(key, JSON.stringify(data), { EX: ttlSeconds });
  } catch {
    // 缓存失败不影响主流程
  }
}

// 读取用户某命名空间的全部偏好（优先 Redis，回源 MySQL）
export async function getUserPreferences(userId: number, namespace = "default"): Promise<Record<string, unknown>> {
  const ns = normalizeKey(namespace);

  // 先查缓存
  const cached = await readNamespaceCache(userId, ns);
  if (cached) return cached;

  // 回源查询 MySQL
  const db = await getDrizzle();
  const rows: UserPreferenceRow[] = await db
    .select()
    .from(auth.userPreferences)
    .where(and(eq(auth.userPreferences.userId, userId), eq(auth.userPreferences.namespace, ns)));

  const result: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      result[r.key] = JSON.parse(r.valueJson);
    } catch {
      // 容错：若 JSON 解析失败，返回原始字符串
      result[r.key] = r.valueJson;
    }
  }

  // 写入缓存
  await writeNamespaceCache(userId, ns, result);
  return result;
}

// 写入单个偏好，包含 upsert 逻辑与缓存刷新
export async function setUserPreference(
  userId: number,
  namespace: string,
  key: string,
  value: unknown
): Promise<void> {
  const ns = normalizeKey(namespace);
  const k = normalizeKey(key);

  const valueJson = JSON.stringify(value ?? {});

  // 尝试更新，若不存在再插入（MySQL 无原生 onConflict API 时采用两段式）
  const db = await getDrizzle();
  const existing = await db
    .select({ id: auth.userPreferences.id })
    .from(auth.userPreferences)
    .where(and(eq(auth.userPreferences.userId, userId), eq(auth.userPreferences.namespace, ns), eq(auth.userPreferences.key, k)));

  if (existing.length > 0) {
    await db
      .update(auth.userPreferences)
      .set({ valueJson })
      .where(and(eq(auth.userPreferences.userId, userId), eq(auth.userPreferences.namespace, ns), eq(auth.userPreferences.key, k)));
  } else {
    await db.insert(auth.userPreferences).values({ userId, namespace: ns, key: k, valueJson });
  }

  // 刷新命名空间缓存：简单策略为重新读取并覆盖
  const fresh = await getUserPreferences(userId, ns);
  await writeNamespaceCache(userId, ns, fresh);
}

// 示例：在主题切换时调用（服务端）
// await setUserPreference(session.userId, "ui", "theme_mode", { mode: "dark" });
// const prefs = await getUserPreferences(session.userId, "ui");
// const themeMode = (prefs["theme_mode"] as any)?.mode ?? "system";