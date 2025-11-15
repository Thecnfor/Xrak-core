import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@features/auth/server/session/kv";
import { extractCsrfToken, validateCsrfToken } from "@infra/security/csrf";
import { SESSION_COOKIE_NAME } from "@features/auth/shared/session";
import { getMysql } from "@infra/db/mysql";
import { verifyPassword, hashPassword } from "@server/auth/password";
import { withApi } from "@server/middleware/api";
import { ok, badRequest, unauthorized, notFound, forbidden } from "@server/api/respond";
import { ensureOnce } from "@core/services/IdempotencyService";
import { recordPasswordChanged } from "@server/auth/sessionAudit";
const Schema = z.object({ currentPassword: z.string().min(6), newPassword: z.string().min(8) });
export async function POST(req: NextRequest) {
  return withApi(req, [], async (ctx) => {
    const raw = await ctx.req.json();
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) return badRequest();
    const ck = ctx.req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
    const session = ck ? await getSession(ck) : null;
    const t = extractCsrfToken(ctx.req.headers);
    if (!session || session.userId <= 0 || !validateCsrfToken(session.csrfSecret, t)) return unauthorized();
    const db = await getMysql();
    const rows = await db.execute("SELECT id,passwordHash FROM users WHERE id=?", [session.userId]);
    const arr = rows[0] as Array<{ id: number; passwordHash: string }>;
    const me = arr?.[0];
    if (!me) return notFound("user_not_found");
    const match = await verifyPassword(me.passwordHash, parsed.data.currentPassword);
    if (!match) return forbidden("invalid_current_password");
    const newHash = await hashPassword(parsed.data.newPassword);
    const key = ctx.req.headers.get("x-idempotency-key") || "";
    if (key) {
      const first = await ensureOnce("idemp:account:password:" + String(session.userId), newHash + ":" + key);
      if (!first) return ok({ ok: true, dedup: true });
    }
    await db.execute("UPDATE users SET passwordHash=? WHERE id=?", [newHash, session.userId]);
    await recordPasswordChanged(session.userId);
    return ok({ ok: true });
  });
}
