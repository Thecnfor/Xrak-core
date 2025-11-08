// 用户密码重置 API（Hono + Zod）
// 说明：示例写操作接入 CSRF 校验与会话验证，并校验当前密码。

import { Hono } from "hono";
import { handle } from "hono/vercel";
import { z } from "zod";
import { extractCsrfToken, validateCsrfToken } from "@/src/utils/csrf";
import { getSession } from "@/src/services/session/kv";
import { getDrizzle } from "@/src/services/db/mysql";
import { users } from "@/drizzle/auth";
import { eq } from "drizzle-orm";
import { verifyPassword, hashPassword } from "@/src/services/auth/password";
import { SESSION_COOKIE_NAME } from "@/src/config/session";

export const runtime = "nodejs"; // 需要 Node 环境访问数据库

const app = new Hono();

// 输入校验：需要当前密码与新密码
const BodySchema = z.object({
  currentPassword: z.string().min(6, "当前密码过短"),
  newPassword: z.string().min(8, "新密码至少 8 位"),
});

app.post("/", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: "invalid_input", details: parsed.error.flatten() },
        400
      );
    }

    // 读取会话与 CSRF
    const sid =
      (c.req.header("cookie") ?? "").match(
        new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
      )?.[1] ?? "";
    const ctx = sid ? await getSession(sid) : null;
    const token = extractCsrfToken(c.req.raw.headers);
    if (!ctx || ctx.userId <= 0 || !validateCsrfToken(ctx.csrfSecret, token)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const db = await getDrizzle();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    const me = rows[0];
    if (!me) return c.json({ error: "user_not_found" }, 404);

    const ok = await verifyPassword(
      me.passwordHash!,
      parsed.data.currentPassword
    );
    if (!ok) return c.json({ error: "invalid_current_password" }, 403);

    const newHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, ctx.userId));
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: "server_error" }, 500);
  }
});

export const POST = handle(app);
