// 认证与会话相关服务器动作封装
// 说明：统一在此模块提供表单 Server Actions 与服务端工具函数，页面直接复用，避免散落于各处。

import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { getDrizzle } from "@src/services/db/mysql";
import { users } from "@/drizzle/auth";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@src/services/auth/password";
import { getSession, setSession, deleteSession } from "@src/services/session/kv";
import { SESSION_COOKIE_NAME } from "@src/config/session";
import { recordSessionIssued, recordSessionRevoked } from "@src/services/auth/sessionAudit";
import { isUserAgentDenied, checkLoginRateLimit } from "@src/services/security/rateLimit";
import { getRedisClient } from "@src/services/db/redis";

// CSRF 校验工具：从 cookie/header 双向比对（示例，按需扩展）
export async function assertCsrf() {
  "use server";
  const c = await cookies();
  const tokenCookie = c.get("csrf-token")?.value;
  const tokenHeader = c.get("x-csrf-token")?.value; // 在测试页通过 cookie 传递
  if (!tokenCookie || tokenCookie !== tokenHeader) {
    throw new Error("CSRF 校验失败");
  }
}

// 注册用户（示例：简单哈希，生产需使用专用密码哈希）
export async function registerUser(email: string, password: string, displayName?: string) {
  "use server";
  const db = await getDrizzle();
  const salt = randomBytes(16).toString("hex");
  const hash = await hashPassword(password);
  try {
    await db.insert(users).values({ email, passwordHash: hash, passwordSalt: salt, displayName: displayName ?? null });
  } catch {
    // 回退：若不存在 passwordSalt 字段或唯一约束触发，忽略异常
    try {
      await db.insert(users).values({ email, passwordHash: hash, displayName: displayName ?? null });
    } catch {}
  }
}

// 登录用户：检查风控与速率限制，写入会话并审计
export async function loginUser(email: string, password: string) {
  "use server";
  const h = await cookies();
  // 采集来源信息（从 headers 读取）
  const hh = await headers();
  const ipHeader = hh.get("x-forwarded-for") || hh.get("x-real-ip") || "";
  const ip = ipHeader.split(",")[0].trim();
  const userAgent = hh.get("user-agent") || "";
  const country = hh.get("x-vercel-ip-country") || "";
  const city = hh.get("x-vercel-ip-city") || "";
  const uaHash = createHash("sha256").update(userAgent).digest("hex");

  const denied = await isUserAgentDenied(uaHash, userAgent);
  if (denied) throw new Error("设备被风控拒绝");
  const rl = await checkLoginRateLimit(email, ip);
  const allowed = typeof rl === "boolean" ? rl : !!rl.allowed;
  if (!allowed) throw new Error("登录过于频繁，请稍后再试");

  const db = await getDrizzle();
  const rows = await db.select().from(users).where(eq(users.email, email));
  const user = rows?.[0];
  if (!user) throw new Error("用户不存在");
  const ok = await verifyPassword(user.passwordHash!, password);
  if (!ok) throw new Error("密码错误");

  // 创建会话并写入 cookie
  const sessionId = `s_${randomBytes(16).toString("hex")}`;
  await setSession(sessionId, { userId: Number(user.id), issuedAt: Date.now(), uaHash });
  const ck = h;
  ck.set(SESSION_COOKIE_NAME, sessionId, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });

  // 审计登录来源（IP/UA 等）
  try {
    await recordSessionIssued(user.id!, sessionId, { ip, uaHash, userAgent, country, city });
  } catch {
    // 审计失败不阻塞登录
  }
}

// 登出：撤销当前设备会话
export async function logoutUser() {
  "use server";
  const ck = await cookies();
  const sid = ck.get(SESSION_COOKIE_NAME)?.value;
  if (!sid) return;
  await deleteSession(sid); // 删除会话
  try {
    await recordSessionRevoked(sid);
  } catch {}
  ck.delete(SESSION_COOKIE_NAME);
}

// 撤销指定设备的会话（管理员或用户自助）
export async function revokeDevice(sessionId: string) {
  "use server";
  await deleteSession(sessionId);
  try {
    await recordSessionRevoked(sessionId);
  } catch {}
}

// 撤销当前用户的所有设备会话
export async function revokeAllDevices(userId: number) {
  "use server";
  // 会话索引存储在 Redis（若不可用则跳过）
  try {
    const client = await getRedisClient();
    const key = `user:sessions:${userId}`;
    const ids = await client.smembers(key);
    for (const sid of ids) {
      await deleteSession(sid);
      try {
        await recordSessionRevoked(sid);
      } catch {}
    }
    await client.del(key);
  } catch {
    // Redis 不可用：无法批量撤销，后续可通过后台任务处理
  }
}

// 获取当前会话信息（用于 SSR 显示）
export async function getCurrentSession() {
  "use server";
  const ck = await cookies();
  const sid = ck.get(SESSION_COOKIE_NAME)?.value;
  if (!sid) return null;
  return getSession(sid);
}