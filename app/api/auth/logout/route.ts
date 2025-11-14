import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@features/auth/shared/session";
import { deleteSession } from "@features/auth/server/session/kv";
import { recordSessionRevoked } from "@server/auth/sessionAudit";
import { withApi } from "@server/middleware/api";
import { ok } from "@server/api/respond";
export async function POST(req: NextRequest) {
  return withApi(req, [], async () => {
    const c = await cookies();
    const sid = c.get(SESSION_COOKIE_NAME)?.value;
    if (sid) { await deleteSession(sid); await recordSessionRevoked(sid); }
    return ok({ ok: true });
  });
}
