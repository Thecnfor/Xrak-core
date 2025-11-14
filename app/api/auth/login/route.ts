import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMysql } from "@infra/db/mysql";
import { verifyPassword } from "@server/auth/password";
import { randomBytes, createHash } from "crypto";
import { setSession } from "@features/auth/server/session/kv";
import { SESSION_COOKIE_NAME } from "@features/auth/shared/session";
import { recordSessionIssued } from "@server/auth/sessionAudit";
import { withApi } from "@server/middleware/api";
import { makeSetCookie } from "@server/auth/cookies";
import { recordLoginFailed } from "@server/auth/sessionAudit";
const Schema = z.object({ email: z.string().email(), password: z.string().min(8) });
export async function POST(req: NextRequest) {
  return withApi(req, [], async (ctx) => {
  const raw = await ctx.req.json();
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const db = await getMysql();
  const rows = await db.execute("SELECT id,email,passwordHash FROM users WHERE email=?", [parsed.data.email]);
  const arr = rows[0] as Array<{ id: number; email: string; passwordHash: string }>;
  const user = arr?.[0];
  if (!user) { await recordLoginFailed(parsed.data.email, { reason: "user_not_found" }); return NextResponse.json({ error: "user_not_found" }, { status: 404 }); }
  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) { await recordLoginFailed(parsed.data.email, { reason: "invalid_password" }); return NextResponse.json({ error: "invalid_password" }, { status: 403 }); }
  const sid = randomBytes(16).toString("hex");
  const hh = ctx.req.headers;
  const ipHeader = hh.get("x-forwarded-for") || hh.get("x-real-ip") || "";
  const ip = ipHeader.split(",")[0].trim();
  const userAgent = hh.get("user-agent") || "";
  const uaHash = createHash("sha256").update(userAgent).digest("hex");
  await setSession(sid, { userId: Number(user.id), issuedAt: Date.now(), uaHash });
  await recordSessionIssued(user.id, sid, { ip, uaHash, userAgent });
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", makeSetCookie(SESSION_COOKIE_NAME, sid));
  return res;
  });
}
