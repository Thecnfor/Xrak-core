// 安全管理后台 API（Hono）
// 说明：维护 UA 黑名单（哈希与原始 UA）与登录限流配置；仅服务端调用。

import { Hono } from "hono";
import type { Context } from "hono";
import { handle } from "hono/vercel";
import { z } from "zod";
import { extractCsrfToken, validateCsrfToken } from "@/src/utils/csrf";
import { getSession } from "@/src/services/session/kv";
import { getUaBlacklist, addUaBlacklist, removeUaBlacklist, getLoginRateLimitConfig, setLoginRateLimitConfig, isAdminEmail } from "@src/services/security/config";
import { SESSION_COOKIE_NAME } from "@/src/config/session";

export const runtime = "nodejs"; // 需要 Node 环境访问 Redis

const app = new Hono();

// 辅助：从 Cookie 头读取 sid（避免在路由中依赖特定运行时 cookies API）
function readSidFromCookieHeader(header: string | null): string | null {
  const h = header ?? "";
  for (const part of h.split(/;\s*/)) {
    if (!part) continue;
    const i = part.indexOf("=");
    if (i === -1) continue;
    const name = decodeURIComponent(part.slice(0, i));
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(i + 1));
    }
  }
  return null;
}

// 管理端权限与 CSRF 校验
// 路由上下文类型严格化，避免使用 any
async function assertAdmin(c: Context): Promise<boolean> {
  const sid = readSidFromCookieHeader(c.req.header("cookie") ?? null);
  if (!sid) return false;
  const ctx = await getSession(sid);
  const token = extractCsrfToken(c.req.raw.headers);
  if (!ctx || ctx.userId <= 0 || !validateCsrfToken(ctx.csrfSecret, token)) return false;
  // 管理员角色判定：优先查看会话 roles，其次通过管理员邮箱集合/环境变量
  const hasRole = Array.isArray(ctx.roles) && ctx.roles.includes("admin");
  const byEmail = await isAdminEmail(ctx.email);
  if (!hasRole && !byEmail) return false;
  return true;
}

// UA 黑名单：查询
app.get("/ua", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const list = await getUaBlacklist();
  return c.json(list);
});

// UA 黑名单：新增（批量）
const UaUpdateSchema = z.object({ hashes: z.array(z.string()).optional(), raw: z.array(z.string()).optional() });
app.post("/ua", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const data = await c.req.json();
  const parsed = UaUpdateSchema.safeParse(data);
  if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  await addUaBlacklist({ hashes: parsed.data.hashes ?? [], raw: parsed.data.raw ?? [] });
  const list = await getUaBlacklist();
  return c.json(list);
});

// UA 黑名单：移除（批量）
app.post("/ua/remove", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const data = await c.req.json();
  const parsed = UaUpdateSchema.safeParse(data);
  if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  await removeUaBlacklist({ hashes: parsed.data.hashes ?? [], raw: parsed.data.raw ?? [] });
  const list = await getUaBlacklist();
  return c.json(list);
});

// 登录限流配置：查询
app.get("/rate-limit", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const cfg = await getLoginRateLimitConfig();
  return c.json(cfg);
});

// 登录限流配置：更新
const RateLimitSchema = z.object({
  windowSeconds: z.number().int().min(10).max(24 * 3600),
  maxPerIp: z.number().int().min(1).max(1000),
  maxPerEmail: z.number().int().min(1).max(1000),
});
app.put("/rate-limit", async (c) => {
  if (!(await assertAdmin(c))) return c.json({ error: "unauthorized" }, 401);
  const data = await c.req.json();
  const parsed = RateLimitSchema.safeParse(data);
  if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  await setLoginRateLimitConfig(parsed.data);
  const cfg = await getLoginRateLimitConfig();
  return c.json(cfg);
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);