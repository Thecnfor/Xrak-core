import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { getSession, setSession } from "@features/auth/server/session/kv";
import { recordSessionIssued, recordSessionRefreshed } from "@server/auth/sessionAudit";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@features/auth/shared/session";
import { makeSetCookie } from "@server/auth/cookies";
export async function GET(req: NextRequest) {
  const ck = req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
  let sid = ck;
  let ctx = sid ? await getSession(sid) : null;
  const ua = req.headers.get("user-agent") || "";
  const uaHash = ua ? createHash("sha256").update(ua).digest("hex").slice(0, 16) : "";
  let setCookie: string | undefined;
  if (!sid || !ctx) {
    sid = randomUUID().replace(/-/g, "");
    ctx = { userId: 0, uaHash };
    await setSession(sid, ctx, SESSION_TTL_SECONDS);
    const ipHeader = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const ip = ipHeader.split(",")[0].trim();
    const country = req.headers.get("x-vercel-ip-country") || "";
    const city = req.headers.get("x-vercel-ip-city") || "";
    await recordSessionIssued(0, sid, { ip, uaHash, userAgent: ua, country, city });
    setCookie = makeSetCookie(SESSION_COOKIE_NAME, sid);
  } else {
    const now = Math.floor(Date.now() / 1000);
    const ttlLeft = typeof ctx.expiresAt === "number" ? Math.max(1, ctx.expiresAt - now) : SESSION_TTL_SECONDS;
    const patched = { ...ctx, uaHash: ctx.uaHash || uaHash };
    await setSession(sid, patched, ttlLeft);
    const ipHeader = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const ip = ipHeader.split(",")[0].trim();
    await recordSessionRefreshed(sid, { ip, uaHash, userAgent: ua });
  }
  const res = NextResponse.json({ session: ctx, cookies: { [SESSION_COOKIE_NAME]: sid } });
  if (setCookie) res.headers.set("set-cookie", setCookie);
  return res;
}
