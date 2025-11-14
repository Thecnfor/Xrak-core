import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@features/auth/server/session/kv";
import { extractCsrfToken, validateCsrfToken } from "@infra/security/csrf";
import { SESSION_COOKIE_NAME } from "@features/auth/shared/session";
import { getMysql } from "@infra/db/mysql";
import { withApi } from "@server/middleware/api";
import { ok, badRequest, unauthorized } from "@server/api/respond";
import { ensureOnce } from "../../../../src/core/services/IdempotencyService";
const Schema = z.object({ displayName: z.string().min(1).max(64) });
export async function POST(req: NextRequest) {
  return withApi(req, [], async (ctx) => {
    const raw = await ctx.req.json();
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) return badRequest();
    const ck = ctx.req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
    const session = ck ? await getSession(ck) : null;
    const t = extractCsrfToken(ctx.req.headers);
    if (!session || session.userId <= 0 || !validateCsrfToken(session.csrfSecret, t)) return unauthorized();
    const key = ctx.req.headers.get("x-idempotency-key") || "";
    if (key) {
      const first = await ensureOnce("idemp:account:profile:" + String(session.userId), parsed.data.displayName + ":" + key);
      if (!first) return ok({ ok: true, dedup: true });
    }
    const db = await getMysql();
    await db.execute("UPDATE users SET displayName=? WHERE id=?", [parsed.data.displayName, session.userId]);
    return ok({ ok: true });
  });
}
