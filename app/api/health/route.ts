import { NextResponse } from "next/server";
import { createClient } from "redis";
export async function GET() {
  const r = createClient({ url: process.env.REDIS_URL });
  r.on("error", () => {});
  await r.connect();
  try {
    const status = await r.get("sys:db:status");
    const atRaw = await r.get("sys:db:lastChange");
    const at = atRaw ? Number(atRaw) : Date.now();
    return NextResponse.json({ ok: status === "up", ts: at });
  } catch {
    return NextResponse.json({ ok: true, ts: Date.now() });
  } finally {
    try { await r.disconnect(); } catch {}
  }
}
