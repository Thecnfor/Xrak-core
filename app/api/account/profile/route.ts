// 用户资料修改 API（Hono + Zod）
// 说明：示例写操作接入 CSRF 校验与会话验证，便于在真实业务中复用。

import { Hono } from "hono";
import { handle } from "hono/vercel";
import { z } from "zod";
import { extractCsrfToken, validateCsrfToken } from "@/src/utils/csrf";
import { getSession } from "@/src/services/session/kv";
import { getDrizzle } from "@/src/services/db/mysql";
import { users } from "@/drizzle/auth";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME } from "@/src/config/session";

export const runtime = "nodejs"; // 需要 Node 环境访问数据库

const app = new Hono();

// 输入校验：仅允许更新 displayName
const BodySchema = z.object({
  displayName: z.string().min(1, "昵称不能为空").max(64, "昵称过长"),
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

    // 执行更新
    const db = await getDrizzle();
    await db
      .update(users)
      .set({ displayName: parsed.data.displayName })
      .where(eq(users.id, ctx.userId));
    return c.json({ ok: true });
  } catch (e) {
    // 数据库或解析错误
    return c.json({ error: "server_error" }, 500);
  }
});

export const POST = handle(app);
