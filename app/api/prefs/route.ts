import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMysql } from "@infra/db/mysql";
import { getSession } from "@features/auth/server/session/kv";
import { SESSION_COOKIE_NAME } from "@features/auth/shared/session";
import { extractCsrfToken, validateCsrfToken } from "@infra/security/csrf";
import { isAdminEmail } from "@infra/security/config";
import { createHash } from "crypto";
import { ensureOnce } from "@server/services/IdempotencyService";
import { withApi } from "@server/middleware/api";
import { ok, badRequest, unauthorized, forbidden } from "@server/api/respond";
export async function GET(req: NextRequest) {
  return withApi(req, [], async (ctx) => {
    const db = await getMysql();
    const appRows = await db.execute("SELECT `key`,`value` FROM prefs_app", []);
    const appArr = appRows[0] as Array<{ key: string; value: string }>;
    const appPrefs: Record<string, unknown> = {};
    for (const r of appArr) { try { appPrefs[r.key] = JSON.parse(r.value as unknown as string); } catch { appPrefs[r.key] = r.value; } }
    const ck = ctx.req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
    const session = ck ? await getSession(ck) : null;
    const uid = session?.userId ?? 0;
    const userPrefs: Record<string, unknown> = {};
    if (uid > 0) {
      const userRows = await db.execute("SELECT `key`,`value` FROM prefs_user WHERE user_id=?", [uid]);
      const userArr = userRows[0] as Array<{ key: string; value: string }>;
      for (const r of userArr) { try { userPrefs[r.key] = JSON.parse(r.value as unknown as string); } catch { userPrefs[r.key] = r.value; } }
    }
    const merged = { ...appPrefs, ...userPrefs };
    const entries = Object.keys(merged).sort().map((k) => [k, merged[k]] as [string, unknown]);
    const stable = JSON.stringify(Object.fromEntries(entries));
    const etag = 'W/"' + createHash("sha256").update(stable).digest("hex") + '"';
    let lastApp = 0;
    let lastUser = 0;
    const appMax = await db.execute("SELECT MAX(updated_at) as m FROM prefs_app", []);
    const appM = (appMax[0] as Array<{ m: string }>)[0]?.m;
    if (appM) lastApp = new Date(appM).getTime();
    if (uid > 0) {
      const userMax = await db.execute("SELECT MAX(updated_at) as m FROM prefs_user WHERE user_id=?", [uid]);
      const userM = (userMax[0] as Array<{ m: string }>)[0]?.m;
      if (userM) lastUser = new Date(userM).getTime();
    }
    const last = Math.max(lastApp, lastUser);
    const ims = ctx.req.headers.get("if-modified-since");
    const inm = ctx.req.headers.get("if-none-match");
    if (inm && inm === etag) return new NextResponse(null, { status: 304 });
    if (ims) {
      const since = new Date(ims).getTime();
      if (last && since && last <= since) return new NextResponse(null, { status: 304 });
    }
    const res = ok({ prefs: merged });
    if (last) res.headers.set("last-modified", new Date(last).toUTCString());
    res.headers.set("etag", etag);
    return res;
  });
}

export async function PUT(req: NextRequest) {
  return withApi(req, [], async (ctx) => {
    const ck = ctx.req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
    const session = ck ? await getSession(ck) : null;
    if (!session || (session.userId ?? 0) <= 0) return unauthorized();
    const t = extractCsrfToken(ctx.req.headers);
    if (!validateCsrfToken(session.csrfSecret, t)) return unauthorized("csrf_failed");
    const idem = ctx.req.headers.get("x-idempotency-key") || "";
    const body = await ctx.req.json();
    const parsed = z.object({ scope: z.enum(["user", "app"]), key: z.string().min(1), value: z.any() }).safeParse(body);
    if (!parsed.success) return badRequest();
    const { scope, key, value } = parsed.data;
    const db = await getMysql();
    const val = JSON.stringify(value ?? null);
    if (scope === "user") {
      if (idem) { const first = await ensureOnce("idemp:prefs:user:" + String(session.userId), key + ":" + idem); if (!first) return ok({ ok: true, dedup: true }); }
      await db.execute("INSERT INTO prefs_user (user_id, `key`, `value`, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=VALUES(updated_at)", [session.userId, key, val]);
      return ok({ ok: true });
    }
    const admin = !!(session.isAdmin || (Array.isArray(session.roles) && session.roles.includes("admin")) || await isAdminEmail(session.email));
    if (!admin) return forbidden();
    if (idem) { const first = await ensureOnce("idemp:prefs:app", key + ":" + idem); if (!first) return ok({ ok: true, dedup: true }); }
    await db.execute("INSERT INTO prefs_app (`key`, `value`, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=VALUES(updated_at)", [key, val]);
    return ok({ ok: true });
  });
}
