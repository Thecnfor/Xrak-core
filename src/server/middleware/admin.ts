import type { Middleware } from "./compose";
import { NextResponse } from "next/server";
import { getSession } from "@server/session/kv";
import { SESSION_COOKIE_NAME } from "@features/auth/shared/session";
import { extractCsrfToken, validateCsrfToken } from "@infra/security/csrf";
import { isAdminEmail } from "@infra/security/config";
export const requireAdmin: Middleware = async (ctx, next) => {
  const ck = ctx.req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
  const s = ck ? await getSession(ck) : null;
  const isAdmin = !!(s?.isAdmin || (Array.isArray(s?.roles) && s.roles.includes("admin")));
  if (!s || (s.userId ?? 0) <= 0) { ctx.res = NextResponse.json({ error: "unauthorized" }, { status: 401 }); return; }
  if (!(isAdmin || await isAdminEmail(s.email))) { ctx.res = NextResponse.json({ error: "forbidden" }, { status: 403 }); return; }
  if (ctx.req.method !== "GET") {
    const t = extractCsrfToken(ctx.req.headers);
    if (!validateCsrfToken(s.csrfSecret, t)) { ctx.res = NextResponse.json({ error: "csrf_failed" }, { status: 401 }); return; }
  }
  ctx.state = { ...(ctx.state || {}), session: s };
  await next();
};