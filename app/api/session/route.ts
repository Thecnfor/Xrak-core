// 会话刷新与引导 API（Hono）
// 说明：用于首次访问时分配匿名会话，或在登出/超时后补发 cookie。
// 返回当前会话上下文与可见 cookies 快照（仅非 HttpOnly 或明确字段）。

import { Hono } from "hono";
import { handle } from "hono/vercel";
import { getSession, setSession } from "@/src/services/session/kv";
import type { SessionContext } from "@/src/types/session";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SESSION_COOKIE_OPTIONS,
} from "@/src/config/session";
import { createHash } from "node:crypto";

export const runtime = "nodejs"; // 兼容 KV 与服务端能力

const app = new Hono();

function parseCookies(header: string | null): Record<string, string> {
  const h = header ?? "";
  const out: Record<string, string> = {};
  for (const part of h.split(/;\s*/)) {
    if (!part) continue;
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = decodeURIComponent(part.slice(0, idx));
    const value = decodeURIComponent(part.slice(idx + 1));
    out[name] = value;
  }
  return out;
}

function makeSetCookie(
  name: string,
  value: string,
  opts?: {
    maxAge?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    httpOnly?: boolean;
  }
): string {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${opts?.path ?? "/"}`,
  ];
  if (typeof opts?.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  if (opts?.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts?.secure) parts.push(`Secure`);
  if (opts?.httpOnly ?? true) parts.push(`HttpOnly`);
  return parts.join("; ");
}

// 兼容根路径与任意子路径的 GET（避免尾随斜杠或路径解析差异导致 404）
const handler = async (c: any) => {
  const cookieHeader = c.req.header("cookie") ?? null;
  const cookies = parseCookies(cookieHeader);
  let sid = cookies[SESSION_COOKIE_NAME];
  let ctx: SessionContext | null = null;
  const ua = c.req.header("user-agent") ?? "";
  const uaHash = ua
    ? createHash("sha256").update(ua).digest("hex").slice(0, 16)
    : "";

  if (sid) {
    ctx = await getSession(sid);
  }

  // 若不存在或已过期，则签发匿名会话（userId=0），并补发 cookie
  let setCookieHeader: string | undefined;
  if (!sid || !ctx) {
    // 签发匿名会话（含 UA 哈希与 CSRF）
    sid = crypto.randomUUID().replace(/-/g, "");
    ctx = { userId: 0, uaHash };
    await setSession(sid, ctx, SESSION_TTL_SECONDS);
    setCookieHeader = makeSetCookie(SESSION_COOKIE_NAME, sid, {
      maxAge: SESSION_TTL_SECONDS,
      path: SESSION_COOKIE_OPTIONS.path,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      secure: SESSION_COOKIE_OPTIONS.secure,
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
    });
  } else {
    // 已存在会话：如缺少字段（CSRF/UA/time），进行补全与回写（滑动过期可在此实现）
    const now = Math.floor(Date.now() / 1000);
    const ttlLeft =
      typeof ctx.expiresAt === "number"
        ? Math.max(1, ctx.expiresAt - now)
        : SESSION_TTL_SECONDS;
    const patched: SessionContext = {
      ...ctx,
      uaHash: ctx.uaHash || uaHash,
    };
    await setSession(sid, patched, ttlLeft);
  }

  const body = {
    session: ctx,
    cookies: { [SESSION_COOKIE_NAME]: sid },
  };

  const res = new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(setCookieHeader ? { "set-cookie": setCookieHeader } : {}),
    },
    status: 200,
  });
  return res;
};

// 根路径
app.get("/", handler);
// 任意路径（容错）
app.get("*", handler);

export const GET = handle(app);
