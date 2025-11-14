import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@server/auth/password";
import { getMysql } from "@infra/db/mysql";
const Schema = z.object({ email: z.string().email(), password: z.string().min(8), displayName: z.string().optional() });
export async function POST(req: NextRequest) {
  const raw = await req.json();
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const db = await getMysql();
  const rows = await db.execute("SELECT id FROM users WHERE email=?", [parsed.data.email]);
  const has = Array.isArray(rows[0]) && rows[0].length > 0;
  if (has) return NextResponse.json({ error: "email_exists" }, { status: 409 });
  const hash = await hashPassword(parsed.data.password);
  await db.execute("INSERT INTO users (email, passwordHash, displayName) VALUES (?, ?, ?)", [parsed.data.email, hash, parsed.data.displayName ?? null]);
  return NextResponse.json({ ok: true });
}
