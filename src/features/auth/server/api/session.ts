import { NextRequest } from "next/server";
import { getSession, setSession } from "../session/kv";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@features/auth/shared/session";

export async function getSessionFromRequest(req: NextRequest) {
  const ck = req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
  const sid = ck;
  const ctx = sid ? await getSession(sid) : null;
  if (sid && ctx) {
    const now = Math.floor(Date.now() / 1000);
    const ttlLeft = typeof ctx.expiresAt === "number" ? Math.max(1, ctx.expiresAt - now) : SESSION_TTL_SECONDS;
    await setSession(sid, { ...ctx }, ttlLeft);
  }
  return { sid, ctx };
}