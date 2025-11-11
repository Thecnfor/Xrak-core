// 统一 Hono 捕获路由：整合 /api/* 端点，减少目录冗余
// 说明：保留原有路径兼容（/api/session、/api/account/profile、/api/account/password、/api/admin/security/*），
// 并统一接入 CSRF、会话与权限校验，满足 Edge-first/Serverless 要求。

import { Hono } from "hono";
import { handle } from "hono/vercel";
import type { Context } from "hono";
import { z } from "zod";

import { extractCsrfToken, validateCsrfToken } from "@src/utils/csrf";
import { getSession, setSession } from "@src/services/session/kv";
import { recordSessionIssued } from "@src/services/auth/sessionAudit";
import type { SessionContext } from "@src/types/session";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SESSION_COOKIE_OPTIONS,
} from "@src/config/session";

import { createHash } from "node:crypto";
import { getDrizzle } from "@src/services/db/mysql";
import { users, userPreferences, adminAuditLogs } from "@/drizzle/auth";
import { eq } from "drizzle-orm";
import { verifyPassword, hashPassword } from "@src/services/auth/password";
import { getUserPreferences, setUserPreference } from "@src/utils/userPrefs";

import {
  getUaBlacklist,
  addUaBlacklist,
  removeUaBlacklist,
  getLoginRateLimitConfig,
  setLoginRateLimitConfig,
  isAdminEmail,
} from "@src/services/security/config";

export const runtime = "nodejs"; // 需要 Node 能力（数据库/Redis/argon2）

// Hono 应用以 /api 作为 basePath，方便匹配完整路径
const app = new Hono().basePath("/api");

// 简易 Cookie 解析（从原始 header）
function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  const h = header ?? "";
  for (const part of h.split(/;\s*/)) {
    if (!part) continue;
    const i = part.indexOf("=");
    if (i === -1) continue;
    const name = decodeURIComponent(part.slice(0, i));
    const val = decodeURIComponent(part.slice(i + 1));
    out[name] = val;
  }
  return out;
}

// Set-Cookie 组装（最小实现）
function makeSetCookie(name: string, value: string, opts: {
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
}) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    ...(opts.maxAge ? [`Max-Age=${opts.maxAge}`] : []),
    ...(opts.path ? [`Path=${opts.path}`] : []),
    ...(opts.sameSite ? [`SameSite=${opts.sameSite}`] : []),
    ...(opts.secure ? ["Secure"] : []),
    ...(opts.httpOnly ? ["HttpOnly"] : []),
  ];
  return parts.join("; ");
}

// 管理端权限与 CSRF 校验
async function assertAdmin(c: Context): Promise<boolean> {
  const cookieHeader = c.req.header("cookie") ?? null;
  const cookies = parseCookies(cookieHeader);
  const sid = cookies[SESSION_COOKIE_NAME] || "";
  if (!sid) return false;
  const ctx = await getSession(sid);
  const token = extractCsrfToken(c.req.raw.headers);
  if (!ctx || ctx.userId <= 0 || !validateCsrfToken(ctx.csrfSecret, token)) return false;
  const hasRole = !!(ctx.isAdmin || (Array.isArray(ctx.roles) && ctx.roles.includes("admin")));
  let byEmail = false;
  try {
    byEmail = await isAdminEmail(ctx.email);
  } catch {
    // 查询管理员邮箱失败时，默认拒绝，避免错误冒泡导致 500
    byEmail = false;
  }
  if (!hasRole && !byEmail) return false;
  return true;
}

// 会话刷新/引导：GET /api/session（兼容任意子路径）
const sessionHandler = async (c: Context) => {
  const cookieHeader = c.req.header("cookie") ?? null;
  const cookies = parseCookies(cookieHeader);
  let sid = cookies[SESSION_COOKIE_NAME];
  let ctx: SessionContext | null = null;
  const ua = c.req.header("user-agent") ?? "";
  const uaHash = ua ? createHash("sha256").update(ua).digest("hex").slice(0, 16) : "";

  if (sid) ctx = await getSession(sid);

  let setCookieHeader: string | undefined;
  if (!sid || !ctx) {
    sid = crypto.randomUUID().replace(/-/g, "");
    ctx = { userId: 0, uaHash };
    await setSession(sid, ctx, SESSION_TTL_SECONDS);
    // 匿名会话审计：记录发放事件，便于后续风控与问题追踪
    try {
      const ipHeader = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "";
      const ip = ipHeader.split(",")[0].trim();
      const country = c.req.header("x-vercel-ip-country") || "";
      const city = c.req.header("x-vercel-ip-city") || "";
      await recordSessionIssued(0, sid, { ip, uaHash, userAgent: ua, country, city });
    } catch {}
    setCookieHeader = makeSetCookie(SESSION_COOKIE_NAME, sid, {
      maxAge: SESSION_TTL_SECONDS,
      path: SESSION_COOKIE_OPTIONS.path,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      secure: SESSION_COOKIE_OPTIONS.secure,
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
    });
  } else {
    const now = Math.floor(Date.now() / 1000);
    const ttlLeft = typeof ctx.expiresAt === "number" ? Math.max(1, ctx.expiresAt - now) : SESSION_TTL_SECONDS;
    const patched: SessionContext = { ...ctx, uaHash: ctx.uaHash || uaHash };
    await setSession(sid, patched, ttlLeft);
  }

  const body = { session: ctx, cookies: { [SESSION_COOKIE_NAME]: sid } };
  return c.newResponse(JSON.stringify(body), 200, {
    "content-type": "application/json; charset=utf-8",
    ...(setCookieHeader ? { "set-cookie": setCookieHeader } : {}),
  });
};

app.get("/session", sessionHandler);
app.get("/session/*", sessionHandler);

// 用户资料修改：POST /api/account/profile
const ProfileSchema = z.object({
  displayName: z.string().min(1, "昵称不能为空").max(64, "昵称过长"),
});
app.post("/account/profile", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = ProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
    }

    const cookieHeader = c.req.header("cookie") ?? null;
    const cookies = parseCookies(cookieHeader);
    const sid = cookies[SESSION_COOKIE_NAME] || "";
    const ctx = sid ? await getSession(sid) : null;
    const token = extractCsrfToken(c.req.raw.headers);
    if (!ctx || ctx.userId <= 0 || !validateCsrfToken(ctx.csrfSecret, token)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const db = await getDrizzle();
    await db.update(users).set({ displayName: parsed.data.displayName }).where(eq(users.id, ctx.userId));
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "server_error" }, 500);
  }
});

// 用户密码重置：POST /api/account/password
const PasswordSchema = z.object({
  currentPassword: z.string().min(6, "当前密码过短"),
  newPassword: z.string().min(8, "新密码至少 8 位"),
});
app.post("/account/password", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = PasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
    }

    const cookieHeader = c.req.header("cookie") ?? null;
    const cookies = parseCookies(cookieHeader);
    const sid = cookies[SESSION_COOKIE_NAME] || "";
    const ctx = sid ? await getSession(sid) : null;
    const token = extractCsrfToken(c.req.raw.headers);
    if (!ctx || ctx.userId <= 0 || !validateCsrfToken(ctx.csrfSecret, token)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const db = await getDrizzle();
    const rows = await db.select().from(users).where(eq(users.id, ctx.userId));
    const me = rows[0];
    if (!me) return c.json({ error: "user_not_found" }, 404);

    const ok = await verifyPassword(me.passwordHash!, parsed.data.currentPassword);
    if (!ok) return c.json({ error: "invalid_current_password" }, 403);

    const newHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, ctx.userId));
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "server_error" }, 500);
  }
});

// 管理安全配置：/api/admin/security/*
const UaUpdateSchema = z.object({ hashes: z.array(z.string()).optional(), raw: z.array(z.string()).optional() });
app.get("/admin/security/ua", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const list = await getUaBlacklist();
  return c.json(list);
});
app.post("/admin/security/ua", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const data = await c.req.json();
  const parsed = UaUpdateSchema.safeParse(data);
  if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  await addUaBlacklist({ hashes: parsed.data.hashes ?? [], raw: parsed.data.raw ?? [] });
  const list = await getUaBlacklist();
  return c.json(list);
});
app.post("/admin/security/ua/remove", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const data = await c.req.json();
  const parsed = UaUpdateSchema.safeParse(data);
  if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  await removeUaBlacklist({ hashes: parsed.data.hashes ?? [], raw: parsed.data.raw ?? [] });
  const list = await getUaBlacklist();
  return c.json(list);
});

const RateLimitSchema = z.object({
  windowSeconds: z.number().int().min(10).max(24 * 3600),
  maxPerIp: z.number().int().min(1).max(1000),
  maxPerEmail: z.number().int().min(1).max(1000),
});
app.get("/admin/security/rate-limit", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const cfg = await getLoginRateLimitConfig();
  return c.json(cfg);
});
app.put("/admin/security/rate-limit", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const data = await c.req.json();
  const parsed = RateLimitSchema.safeParse(data);
  if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  await setLoginRateLimitConfig(parsed.data);
  const cfg = await getLoginRateLimitConfig();
  return c.json(cfg);
});

// 用户偏好设置：GET/PUT /api/preferences
// 读取：GET /api/preferences?namespace=ui（默认 default），返回 { key: value } 字典
// 写入：PUT /api/preferences，JSON: { namespace, key, value }，需要 CSRF 校验与登录态
const PrefsWriteSchema = z.object({
  namespace: z.string().min(1).max(64),
  key: z.string().min(1).max(64),
  value: z.unknown(),
});

app.get("/preferences", async (c) => {
  try {
    const cookieHeader = c.req.header("cookie") ?? null;
    const cookies = parseCookies(cookieHeader);
    const sid = cookies[SESSION_COOKIE_NAME] || "";
    const ctx = sid ? await getSession(sid) : null;
    // 允许匿名读取，但仅限于自身用户（匿名返回空对象），不暴露他人数据
    const ns = (c.req.query("namespace") || "default").trim().toLowerCase();
    const userId = ctx?.userId ?? 0;
    if (userId <= 0) return c.json({ preferences: {} });
    const prefs = await getUserPreferences(userId, ns);
    return c.json({ preferences: prefs });
  } catch {
    return c.json({ error: "server_error" }, 500);
  }
});

app.put("/preferences", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = PrefsWriteSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
    }

    const cookieHeader = c.req.header("cookie") ?? null;
    const cookies = parseCookies(cookieHeader);
    const sid = cookies[SESSION_COOKIE_NAME] || "";
    const ctx = sid ? await getSession(sid) : null;
    const token = extractCsrfToken(c.req.raw.headers);
    if (!ctx || ctx.userId <= 0 || !validateCsrfToken(ctx.csrfSecret, token)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    await setUserPreference(ctx.userId, parsed.data.namespace, parsed.data.key, parsed.data.value);
    // 返回更新后的命名空间偏好，便于客户端同步
    const prefs = await getUserPreferences(ctx.userId, parsed.data.namespace);
    return c.json({ ok: true, preferences: prefs });
  } catch {
    return c.json({ error: "server_error" }, 500);
  }
});

// 管理用户角色：PUT /api/admin/users/:id/roles
// JSON: { roles?: ("admin"|"user")[], isAdmin?: boolean } —— 仅持久化 is_admin
const AdminRolesSchema = z.object({
  roles: z.array(z.enum(["admin", "user"])).optional(),
  isAdmin: z.boolean().optional(),
});
app.put("/admin/users/:id/roles", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const idStr = c.req.param("id");
  const userId = Number(idStr);
  if (!Number.isInteger(userId) || userId <= 0) return c.json({ error: "invalid_user_id" }, 400);
  const raw = await c.req.json();
  const parsed = AdminRolesSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  const makeIsAdmin = parsed.data.isAdmin ?? (parsed.data.roles?.includes("admin") ?? false);
  const db = await getDrizzle();
  await db.update(users).set({ isAdmin: makeIsAdmin }).where(eq(users.id, userId));
  const cookieHeader = c.req.header("cookie") ?? null;
  const cookies = parseCookies(cookieHeader);
  const sid = cookies[SESSION_COOKIE_NAME] || "";
  const me = sid ? await getSession(sid) : null;
  // 审计日志
  await db.insert(adminAuditLogs).values({
    adminUserId: me?.userId ?? 0,
    targetUserId: userId,
    action: "update_roles",
    detailJson: JSON.stringify({ isAdmin: makeIsAdmin, roles: parsed.data.roles ?? [] }),
  });
  return c.json({ ok: true, userId, isAdmin: makeIsAdmin });
});

// 管理用户等级：PUT /api/admin/users/:id/levels
// JSON: { userLevel?: number, vipLevel?: number }
const AdminLevelsSchema = z.object({
  userLevel: z.number().int().min(0).max(100).optional(),
  vipLevel: z.number().int().min(0).max(10).optional(),
});
app.put("/admin/users/:id/levels", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const idStr = c.req.param("id");
  const userId = Number(idStr);
  if (!Number.isInteger(userId) || userId <= 0) return c.json({ error: "invalid_user_id" }, 400);
  const raw = await c.req.json();
  const parsed = AdminLevelsSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  const db = await getDrizzle();
  const patch: Record<string, unknown> = {};
  if (typeof parsed.data.userLevel === "number") patch.userLevel = parsed.data.userLevel;
  if (typeof parsed.data.vipLevel === "number") patch.vipLevel = parsed.data.vipLevel;
  if (Object.keys(patch).length === 0) return c.json({ error: "no_changes" }, 400);
  await db.update(users).set(patch as any).where(eq(users.id, userId));
  const cookieHeader = c.req.header("cookie") ?? null;
  const cookies = parseCookies(cookieHeader);
  const sid = cookies[SESSION_COOKIE_NAME] || "";
  const me = sid ? await getSession(sid) : null;
  // 审计日志
  await db.insert(adminAuditLogs).values({
    adminUserId: me?.userId ?? 0,
    targetUserId: userId,
    action: "update_levels",
    detailJson: JSON.stringify(patch),
  });
  return c.json({ ok: true, userId, ...patch });
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);