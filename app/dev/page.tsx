import React from "react";
import type { RowDataPacket } from "mysql2/promise";
import { cookies, headers } from "next/headers";
import { eq, desc } from "drizzle-orm";

import { getMySQLPool, getDrizzle } from "@/src/services/db/mysql";
import { getMongoDb } from "@/src/services/db/mongo";
import { getRedisClient } from "@/src/services/db/redis";

import { users, authSessionAudit, authLoginAttempts } from "@/drizzle/auth";
import { hashPassword, verifyPassword } from "@/src/services/auth/password";
import { withSpan } from "@/src/observability/server";
import { checkLoginRateLimit, isUserAgentDenied } from "@/src/services/security/rateLimit";
import { isAdminEmail } from "@src/services/security/config";
import {
  recordSessionIssued,
  recordSessionRevoked,
} from "@/src/services/auth/sessionAudit";
import {
  setSession,
  getSession,
  deleteSession,
  listUserSessionIds,
} from "@/src/services/session/kv";
import type { SessionContext } from "@/src/types/session";
import { getDeviceList } from "@/src/utils/sessionDevices";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SESSION_COOKIE_OPTIONS,
} from "@/src/config/session";
import CSRFField from "./CSRFField";

// 在服务器动作中可写的 Cookie 接口（最小定义，避免使用 any）
type MutableCookies = {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
      secure?: boolean;
      domain?: string;
    }
  ): void;
  delete(name: string): void;
};

// 运行时：Node 专用，确保 mysql2/redis/mongodb 可用
export const runtime = "nodejs";
// 强制动态：便于查看最新数据库状态与会话
export const dynamic = "force-dynamic";

// MySQL：使用 information_schema 列出当前库的表（强类型避免 any）
interface TableRow extends RowDataPacket {
  tableName: string;
}
async function listMysqlTables(): Promise<string[]> {
  "use server";
  try {
    const pool = await getMySQLPool();
    const [rows] = await pool.query<TableRow[]>(
      "SELECT TABLE_NAME as tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
    );
    return rows.map((r) => r.tableName);
  } catch {
    return [];
  }
}

// 服务器动作：创建认证相关的表结构与索引（与生产一致，幂等）
async function createAuthSchema() {
  "use server";
  const pool = await getMySQLPool();
  // users 表：包含合规字段与索引
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      passwordSalt VARCHAR(255) NULL,
      displayName VARCHAR(255) NULL,
      emailVerifiedAt DATETIME NULL,
      lastLoginAt DATETIME NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_email (email),
      UNIQUE KEY uniq_users_email (email),
      INDEX idx_users_last_login (lastLoginAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // 会话审计表：记录发放与撤销及来源元数据
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_session_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sessionId VARCHAR(128) NOT NULL,
      userId INT NOT NULL,
      ip VARCHAR(64) NULL,
      uaHash VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      country VARCHAR(64) NULL,
      city VARCHAR(64) NULL,
      issuedAt DATETIME NULL,
      revokedAt DATETIME NULL,
      INDEX idx_auth_session_id (sessionId),
      INDEX idx_auth_session_user (userId),
      INDEX idx_auth_session_ip (ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // 登录尝试表：记录成功/失败以及原因与来源（用于成功率与风控）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      userId INT NULL,
      success TINYINT(1) NOT NULL,
      reason VARCHAR(64) NULL,
      ip VARCHAR(64) NULL,
      uaHash VARCHAR(64) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auth_login_email (email),
      INDEX idx_auth_login_user (userId),
      INDEX idx_auth_login_ip (ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// 查询指定表的索引信息，便于在页面展示合规性
async function getTableIndexes(tableNames: string[]): Promise<Record<string, string[]>> {
  const pool = await getMySQLPool();
  if (tableNames.length === 0) return {};
  const placeholders = tableNames.map(() => "?").join(",");
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME as tableName, INDEX_NAME as indexName
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})
       ORDER BY TABLE_NAME, INDEX_NAME`,
      tableNames
    );
    const map: Record<string, string[]> = {};
    for (const r of rows) {
      const t = String(r.tableName);
      const i = String(r.indexName);
      if (!map[t]) map[t] = [];
      if (!map[t].includes(i)) map[t].push(i);
    }
    return map;
  } catch {
    return {};
  }
}

// MongoDB：列出集合名称
async function listMongoCollections(): Promise<string[]> {
  "use server";
  try {
    const db = await getMongoDb();
    const cols = (await db
      .listCollections({}, { nameOnly: true })
      .toArray()) as Array<{ name: string }>;
    return cols.map((c) => c.name);
  } catch {
    return [];
  }
}

// Redis：采样列出部分 Key（SCAN）
async function listRedisSampleKeys(limit = 50): Promise<string[]> {
  "use server";
  try {
    const client = await getRedisClient();
    let cursor = 0;
    const keys: string[] = [];
    while (true) {
      // 兼容不同客户端返回结构：node-redis v4 返回 { cursor, keys }
      const res = await client.scan(cursor, { COUNT: Math.max(1, Math.min(limit - keys.length, 50)) });
      const nextCursor = Number(res.cursor ?? (Array.isArray(res) ? res[0] : 0));
      const batch: string[] = res.keys ?? (Array.isArray(res) ? res[1] : []);
      keys.push(...batch);
      cursor = nextCursor;
      if (cursor === 0 || keys.length >= limit) break;
    }
    return keys.slice(0, limit);
  } catch {
    return [];
  }
}

// CSRF 校验：从表单隐藏字段读取 token，并比对当前会话的 csrfSecret
async function assertCsrf(formData: FormData): Promise<SessionContext | null> {
  "use server";
  // 通过 headers() 读取 Cookie，避免运行时 cookies API 差异导致不可用
  const h = await headers();
  const cookieHeader = h.get("cookie") || "";
  const sid = (cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)) || [])[1] || "";
  if (!sid) return null;
  const ctx = await getSession(sid);
  const token = String(formData.get("csrf") || "");
  if (!ctx || !token || ctx.csrfSecret !== token) return null;
  return ctx;
}

// 已移除未使用的最小测试表创建函数，避免未使用警告

// 服务器动作：注册用户（CSRF + 最小写入）
async function registerUser(formData: FormData) {
  "use server";
  const csrfCtx = await assertCsrf(formData);
  if (!csrfCtx) return;
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return;
  const db = await getDrizzle();
  // 若用户已存在，直接返回，避免重复插入导致错误日志
  try {
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing && existing.length > 0) return;
  } catch {}
  const hash = await hashPassword(password);
  // 生成合规用的盐值字段（argon2 哈希内部已有随机盐，此处为审计字段）
  const salt = crypto.randomUUID().replace(/-/g, "");
  try {
    await db.insert(users).values({ email, passwordHash: hash, passwordSalt: salt });
  } catch {
    // 回退：旧结构不存在 passwordSalt 字段时，插入基础字段
    try {
      await db.insert(users).values({ email, passwordHash: hash });
    } catch {
      // 二次失败（例如唯一约束或其他原因）直接忽略，避免错误冒泡
    }
  }
}

// 服务器动作：登录（CSRF + 发放 cookie+session，并记录审计）
async function loginUser(formData: FormData) {
  "use server";
  await withSpan("auth.login", async () => {
    const start = Date.now();
    const csrfCtx = await assertCsrf(formData);
    if (!csrfCtx) return;
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    if (!email || !password) return;
    const db = await getDrizzle();
    // 采集请求来源信息
    const h = await headers();
    const ipHeader = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
    const ip = ipHeader.split(",")[0].trim();
    const userAgent = h.get("user-agent") || "";
    const country = h.get("x-vercel-ip-country") || "";
    const city = h.get("x-vercel-ip-city") || "";

    // 风控：UA 黑名单
    if (await isUserAgentDenied(csrfCtx.uaHash, userAgent)) {
      try {
        await db.insert(authLoginAttempts).values({
          email,
          userId: 0,
          success: 0,
          reason: "ua_denied",
          ip,
          uaHash: csrfCtx.uaHash,
        });
      } catch {}
      try {
        const rc = await getRedisClient();
        await rc.incr("metrics:auth:attempts:total");
      } catch {}
      return;
    }

    // 风控：IP/邮箱 窗口限流
    const rl = await checkLoginRateLimit(email, ip);
    if (!rl.allowed) {
      try {
        await db.insert(authLoginAttempts).values({
          email,
          userId: 0,
          success: 0,
          reason: "rate_limited",
          ip,
          uaHash: csrfCtx.uaHash,
        });
      } catch {}
      try {
        const rc = await getRedisClient();
        await rc.incr("metrics:auth:attempts:total");
      } catch {}
      return;
    }

    const rows = await db.select().from(users).where(eq(users.email, email));
    const user = rows[0];
    if (!user) {
      // 记录失败尝试：用户不存在
      try {
        await db.insert(authLoginAttempts).values({
          email,
          userId: 0,
          success: 0,
          reason: "no_user",
          ip,
          uaHash: csrfCtx.uaHash,
        });
      } catch {}
      try {
        const rc = await getRedisClient();
        await rc.incr("metrics:auth:attempts:total");
      } catch {}
      return;
    }

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      // 记录失败尝试：密码错误
      try {
        await db.insert(authLoginAttempts).values({
          email,
          userId: user.id!,
          success: 0,
          reason: "password_mismatch",
          ip,
          uaHash: csrfCtx.uaHash,
        });
      } catch {}
      try {
        const rc = await getRedisClient();
        await rc.incr("metrics:auth:attempts:total");
      } catch {}
      return;
    }

    // 发放会话（KV 写入与 Cookie 同一动作内完成，保障 <200ms）
    const sid = crypto.randomUUID().replace(/-/g, "");
    // 管理员角色：从配置服务判定邮箱是否为管理员
    const roles: string[] = [];
    try {
      if (await isAdminEmail(user.email!)) roles.push("admin");
    } catch {}
    const ctx: SessionContext = {
      userId: user.id!,
      email: user.email!,
      displayName: user.displayName || undefined,
      roles,
      uaHash: csrfCtx.uaHash,
    };
    await setSession(sid, ctx, SESSION_TTL_SECONDS);
    const ck = (await cookies()) as unknown as MutableCookies;
    ck.set(SESSION_COOKIE_NAME, sid, {
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      path: SESSION_COOKIE_OPTIONS.path,
      secure: SESSION_COOKIE_OPTIONS.secure,
      maxAge: SESSION_TTL_SECONDS,
    });

    // 记录会话发放审计与用户最近登录时间
    try {
      await recordSessionIssued(user.id!, sid, { ip, uaHash: csrfCtx.uaHash, userAgent, country, city });
    } catch {}
    try {
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id!));
    } catch {}

    // 记录成功尝试并采集延迟指标
    const durationMs = Date.now() - start;
    try {
      await db.insert(authLoginAttempts).values({
        email,
        userId: user.id!,
        success: 1,
        reason: "",
        ip,
        uaHash: csrfCtx.uaHash,
      });
    } catch {}
    try {
      const rc = await getRedisClient();
      await rc.lPush("metrics:auth:latency", String(durationMs));
      await rc.lTrim("metrics:auth:latency", 0, 99); // 只保留最近 100 次
      await rc.incr("metrics:auth:attempts:total");
      await rc.incr("metrics:auth:attempts:success");
    } catch {}
  });
}

// 服务器动作：登出（CSRF + 撤销 session）
async function logoutUser(formData?: FormData) {
  "use server";
  if (formData) {
    const ok = await assertCsrf(formData);
    if (!ok) return;
  }
  const h = await headers();
  const cookieHeader = h.get("cookie") || "";
  const sid = (cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)) || [])[1] || "";
  if (sid) {
    await deleteSession(sid);
    await recordSessionRevoked(sid);
    const ck = (await cookies()) as unknown as MutableCookies;
    ck.delete(SESSION_COOKIE_NAME);
  }
}

// 服务器动作：注销指定设备（会话 SID）
async function revokeDevice(formData: FormData) {
  "use server";
  const csrfCtx = await assertCsrf(formData);
  if (!csrfCtx) return;
  const targetSid = String(formData.get("sid") || "");
  if (!targetSid) return;
  const h = await headers();
  const cookieHeader = h.get("cookie") || "";
  const currentSid = (cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)) || [])[1] || "";
  await deleteSession(targetSid);
  await recordSessionRevoked(targetSid);
  if (currentSid && currentSid === targetSid) {
    const ck = cookies();
    ck.delete(SESSION_COOKIE_NAME);
  }
}

// 服务器动作：注销当前用户的全部设备
async function revokeAllDevices(formData: FormData) {
  "use server";
  const csrfCtx = await assertCsrf(formData);
  if (!csrfCtx) return;
  const userIdNum = Number(formData.get("userId") || 0);
  if (!userIdNum || userIdNum <= 0) return;
  const h = await headers();
  const cookieHeader = h.get("cookie") || "";
  const currentSid = (cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)) || [])[1] || "";
  const ids = await listUserSessionIds(userIdNum);
  for (const sid of ids) {
    await deleteSession(sid);
    await recordSessionRevoked(sid);
    if (currentSid && currentSid === sid) {
      const ck = (await cookies()) as unknown as MutableCookies;
      ck.delete(SESSION_COOKIE_NAME);
    }
  }
}

// SSR：查询当前用户会话
async function getCurrentSession(): Promise<SessionContext | null> {
  // 在服务器组件中使用 headers() 解析 Cookie 更稳定
  const h = await headers();
  const cookieStr = h.get("cookie") || "";
  const sid =
    cookieStr.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1] ?? "";
  if (!sid) return null;
  return await getSession(sid);
}

// SSR：三库状态聚合
async function getThreeDbStatus(): Promise<{
  mysql: { ok: boolean; tables: string[] };
  mongo: { ok: boolean; collections: string[] };
  redis: { ok: boolean; keys: string[] };
}> {
  const [mysqlTables, mongoCols, redisKeys] = await Promise.all([
    listMysqlTables(),
    listMongoCollections(),
    listRedisSampleKeys(50),
  ]);
  return {
    mysql: { ok: mysqlTables.length >= 0, tables: mysqlTables },
    mongo: { ok: mongoCols.length >= 0, collections: mongoCols },
    redis: { ok: redisKeys.length >= 0, keys: redisKeys },
  };
}

// 查询最近的会话审计日志（便于验证登录/登出行为）
async function getRecentSessionAudits(
  limit = 10
): Promise<
  Array<{
    id: number;
    sessionId: string;
    userId: number;
    issuedAt: Date | null;
    revokedAt: Date | null;
  }>
> {
  const db = await getDrizzle();
  try {
    const rows = await db
      .select()
      .from(authSessionAudit)
      .limit(limit)
      .orderBy(desc(authSessionAudit.id));
    return rows.map((r) => ({
      id: r.id!,
      sessionId: r.sessionId!,
      userId: r.userId!,
      issuedAt: r.issuedAt ?? null,
      revokedAt: r.revokedAt ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function DevPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const status = await getThreeDbStatus();
  const session = await getCurrentSession();
  const audits = await getRecentSessionAudits(10);
  const devices = session && session.userId > 0 ? await getDeviceList(session.userId) : [];
  const page = Number(searchParams?.page || 1) || 1;
  // 合规索引展示：查询三张认证相关表的索引
  const authIndexes = await getTableIndexes(["users", "auth_session_audit", "auth_login_attempts"]);
  // 指标聚合：从 Redis 读取最近延迟与成功率
  async function getAuthMetrics() {
    try {
      const rc = await getRedisClient();
      const total = Number((await rc.get("metrics:auth:attempts:total")) || 0);
      const success = Number((await rc.get("metrics:auth:attempts:success")) || 0);
      const latencies = (await rc.lRange("metrics:auth:latency", 0, 49)) || [];
      const nums = latencies.map((s: string) => Number(s)).filter((n: number) => Number.isFinite(n));
      const avg = nums.length ? Math.round(nums.reduce((a: number, b: number) => a + b, 0) / nums.length) : 0;
      const max = nums.length ? Math.max(...nums) : 0;
      const min = nums.length ? Math.min(...nums) : 0;
      const rate = total > 0 ? Math.round((success / total) * 100) : 0;
      return { total, success, rate, avg, min, max };
    } catch {
      return { total: 0, success: 0, rate: 0, avg: 0, min: 0, max: 0 };
    }
  }
  const metrics = await getAuthMetrics();

  return (
    <div style={{ padding: 24, background: "#ffffff", color: "#111827" }}>
      {/* 页内仅展示最小而完整的三库状态与登录流程，生产环境可直接复用此结构 */}
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        三库状态与认证流程（Dev/Prod 可用）
      </h1>
      <p style={{ opacity: 0.8, marginBottom: 18 }}>
        通过全局包裹（SessionRoot/Query/SEO/Toaster/Observability）保持页面简洁，集成 CSRF + Session + Cookie + 会话审计。
      </p>

      {/* 三库状态展示 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>MySQL</h2>
          {status.mysql.tables.length === 0 ? (
            <p style={{ opacity: 0.8 }}>当前库无表或连接不可用。</p>
          ) : (
            <ul data-testid="list-mysql-tables" style={{ listStyle: "disc", paddingLeft: 20 }}>
              {status.mysql.tables.map((t) => (
                <li key={t} style={{ marginBottom: 4 }}>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>MongoDB</h2>
          {status.mongo.collections.length === 0 ? (
            <p style={{ opacity: 0.8 }}>当前库无集合或连接不可用。</p>
          ) : (
            <ul data-testid="list-mongo-collections" style={{ listStyle: "disc", paddingLeft: 20 }}>
              {status.mongo.collections.map((n) => (
                <li key={n} style={{ marginBottom: 4 }}>
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Redis</h2>
          {status.redis.keys.length === 0 ? (
            <p style={{ opacity: 0.8 }}>暂无可见键或连接不可用。</p>
          ) : (
            <ul data-testid="list-redis-keys" style={{ listStyle: "disc", paddingLeft: 20 }}>
              {status.redis.keys.map((k) => (
                <li key={k} style={{ marginBottom: 4 }}>
                  {k}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 认证结构与索引 + 指标面板 */}
      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>认证结构与索引</h2>
        <form action={createAuthSchema} style={{ marginBottom: 12 }}>
          <button data-testid="btn-create-auth-schema" type="submit" style={{ padding: "8px 12px" }}>
            创建/修复认证表结构与索引（users / session_audit / login_attempts）
          </button>
        </form>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {["users", "auth_session_audit", "auth_login_attempts"].map((t) => (
            <div key={t} style={{ border: "1px dashed #e5e7eb", borderRadius: 8, padding: 10 }}>
              <strong style={{ display: "block", marginBottom: 6 }}>{t}</strong>
              {authIndexes[t] && authIndexes[t].length > 0 ? (
                <ul style={{ listStyle: "disc", paddingLeft: 20 }}>
                  {authIndexes[t].map((i) => (
                    <li key={`${t}:${i}`}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ opacity: 0.75 }}>未查询到索引或表不存在。</p>
              )}
            </div>
          ))}
        </div>
        <hr style={{ margin: "16px 0" }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>认证监控指标</h3>
        <ul style={{ listStyle: "none", paddingLeft: 0, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>尝试次数：{metrics.total}</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>成功次数：{metrics.success}</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>成功率：{metrics.rate}%</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>平均响应：{metrics.avg}ms</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>最慢：{metrics.max}ms</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>最快：{metrics.min}ms</li>
        </ul>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          会话发放延迟采集自一次登录动作内的 KV 写入与 Cookie 设置，总体目标保持 &lt;200ms。
          匿名会话与 CSRF 令牌由全局挂件（SessionRoot）首次刷新时下发，避免页面阻塞。
        </p>
      </section>

      <hr style={{ margin: "24px 0" }} />
      {/* 内容浏览：MongoDB 博客文章，支持分页与 Redis 缓存（未认证可访问） */}
      {await MongoBlogSection(page)}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>注册</h2>
          <form data-testid="form-register" action={registerUser} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
            {/* 注入 CSRF 令牌（来自 SessionRoot 刷新的会话） */}
            <CSRFField />
            <input
              data-testid="input-register-email"
              name="email"
              type="email"
              placeholder="邮箱"
              required
              style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
            <input
              data-testid="input-register-password"
              name="password"
              type="password"
              placeholder="密码"
              required
              style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
            <button data-testid="btn-register" type="submit" style={{ padding: "8px 12px" }}>
              注册用户
            </button>
          </form>
        </section>
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>登录</h2>
          <form data-testid="form-login" action={loginUser} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
            <CSRFField />
            <input
              data-testid="input-login-email"
              name="email"
              type="email"
              placeholder="邮箱"
              required
              style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
            <input
              data-testid="input-login-password"
              name="password"
              type="password"
              placeholder="密码"
              required
              style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
            <button data-testid="btn-login" type="submit" style={{ padding: "8px 12px" }}>
              登录并发放会话
            </button>
          </form>
          <form action={logoutUser} style={{ marginTop: 12 }}>
            <CSRFField />
            <button data-testid="btn-logout" type="submit" style={{ padding: "8px 12px" }}>
              登出（撤销会话）
            </button>
          </form>
        </section>
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>当前会话</h2>
        {!session ? (
          <p style={{ opacity: 0.8 }}>未登录或会话已失效。</p>
        ) : (
          <pre
            data-testid="pre-ssr-session"
            style={{ background: "#0b1220", color: "#e5e7eb", padding: 12, borderRadius: 8 }}
          >
            {JSON.stringify(session, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>会话审计日志（最新 10 条）</h2>
        {audits.length === 0 ? (
          <p style={{ opacity: 0.8 }}>暂无审计记录。</p>
        ) : (
          <pre
            data-testid="pre-audits"
            style={{ background: "#0b1220", color: "#e5e7eb", padding: 12, borderRadius: 8 }}
          >
            {JSON.stringify(audits, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>我的设备（会话）</h2>
        {!session || session.userId <= 0 ? (
          <p style={{ opacity: 0.8 }}>请先登录后查看设备列表。</p>
        ) : devices.length === 0 ? (
          <p style={{ opacity: 0.8 }}>暂无设备。</p>
        ) : (
          <div>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {devices.map((d) => (
                <li
                  key={d.sid}
                  style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}
                >
                  <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 6 }}>
                    {d.sid.slice(0, 8)}…
                  </code>
                  <span style={{ opacity: 0.8 }}>ua={d.uaHash || ""}</span>
                  <span style={{ opacity: 0.8 }}>issuedAt={d.issuedAt ?? "-"}</span>
                  <span style={{ opacity: 0.8 }}>expiresAt={d.expiresAt ?? "-"}</span>
                  <form action={revokeDevice} style={{ marginLeft: "auto" }}>
                    <CSRFField />
                    <input type="hidden" name="sid" value={d.sid} />
                    <button data-testid={`btn-revoke-${d.sid}`} type="submit" style={{ padding: "6px 10px" }}>
                      注销此设备
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={revokeAllDevices} style={{ marginTop: 8 }}>
              <CSRFField />
              <input type="hidden" name="userId" value={session.userId} />
              <button data-testid="btn-revoke-all" type="submit" style={{ padding: "6px 10px" }}>
                注销全部设备
              </button>
            </form>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 24 }}>
        提示：CSRF 令牌由全局 SessionRoot 与 /api/session 自动下发；如发现表单提交未生效，请刷新页面。
      </p>
    </div>
  );
}

// MongoDB 内容：分页读取博客文章并使用 Redis 缓存
type BlogPost = {
  _id?: string;
  title?: string;
  slug?: string;
  createdAt?: Date | string;
  summary?: string;
};

async function getBlogPage(page = 1, pageSize = 5): Promise<{ items: BlogPost[]; page: number; pageSize: number }> {
  const client = await getRedisClient();
  const key = `cache:blog:page:${page}:${pageSize}`;
  try {
    const cached = await client.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}
  try {
    const db = await getMongoDb();
    const col = db.collection("posts");
    const docs = (await col
      .find({}, { projection: { title: 1, slug: 1, createdAt: 1, summary: 1 } })
      .sort({ createdAt: -1 })
      .skip(Math.max(0, (page - 1) * pageSize))
      .limit(pageSize)
      .toArray()) as unknown as Array<{ _id?: unknown; title?: string; slug?: string; createdAt?: unknown; summary?: string }>;
    const items: BlogPost[] = docs.map((d) => ({
      _id: d._id ? String(d._id) : undefined,
      title: d.title,
      slug: d.slug,
      // createdAt 为 unknown，这里统一转换为字符串，兼容 Date/string
      createdAt: d.createdAt ? String(d.createdAt) : undefined,
      summary: d.summary,
    }));
    const payload = { items, page, pageSize };
    try {
      await client.set(key, JSON.stringify(payload), { EX: 60 }); // 简易缓存 60s
    } catch {}
    return payload;
  } catch {
    return { items: [], page, pageSize };
  }
}

async function MongoBlogSection(page: number) {
  const pageSize = 5;
  const { items } = await getBlogPage(page, pageSize);
  return (
    <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>博客内容（MongoDB）</h2>
      {items.length === 0 ? (
        <p style={{ opacity: 0.8 }}>暂无文章或数据源为空。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {items.map((p, i) => (
            <li key={(p.slug || p._id || String(i)) + "-blog-item"} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{p.title || p.slug}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{String(p.createdAt || "")}</div>
              {p.summary ? <div style={{ fontSize: 13 }}>{p.summary}</div> : null}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <a href={`?page=${Math.max(1, page - 1)}`} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}>
          上一页
        </a>
        <a href={`?page=${page + 1}`} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}>
          下一页
        </a>
      </div>
    </section>
  );
}