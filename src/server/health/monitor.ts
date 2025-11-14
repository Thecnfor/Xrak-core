import { getMysql } from "@infra/db/mysql";
import { createClient } from "redis";
let started = false;
async function publish(redis: ReturnType<typeof createClient>, payload: unknown) { try { await redis.publish("sys:db:broadcast", JSON.stringify(payload)); } catch {} }
export async function ensureHealthMonitor() {
  if (started) return;
  started = true;
  const redis = createClient({ url: process.env.REDIS_URL });
  redis.on("error", () => {});
  await redis.connect();
  async function setSnapshot(s: { status: string; at?: number; backoffMs?: number }) {
    try {
      const at = s.at ?? Date.now();
      await redis.set("sys:db:status", s.status);
      await redis.set("sys:db:lastChange", String(at));
      if (typeof s.backoffMs === "number") await redis.set("sys:db:backoffMs", String(s.backoffMs));
    } catch {}
  }
  async function getLock() { try { const id = String(process.pid); const ok = await redis.set("sys:db:lock", id, { NX: true, EX: 30 }); return !!ok; } catch { return false; } }
  async function renew() { try { const id = String(process.pid); await redis.set("sys:db:lock", id, { EX: 30 }); } catch {} }
  async function pingDb() { try { const db = await getMysql(); await db.execute("SELECT 1", []); return true; } catch { return false; } }
  async function loop() {
    try {
      const has = await getLock();
      if (!has) { setTimeout(loop, 2000); return; }
      let backoff = 1000;
      for (;;) {
        const ok = await pingDb();
        if (ok) { await setSnapshot({ status: "up", backoffMs: 1000 }); await publish(redis, { type: "status", status: "up", at: Date.now(), backoffMs: 1000 }); await renew(); await new Promise((r) => setTimeout(r, 2000)); }
        else { backoff = Math.min(backoff * 2, 120000); await setSnapshot({ status: "down", backoffMs: backoff }); await publish(redis, { type: "status", status: "down", at: Date.now(), backoffMs: backoff }); await renew(); await new Promise((r) => setTimeout(r, backoff)); }
      }
    } catch { setTimeout(loop, 2000); }
  }
  loop();
}