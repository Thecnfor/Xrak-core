import { getMysql } from "@infra/db/mysql";
export async function insertLog(level: string, msg: string, meta?: unknown) {
  const db = await getMysql();
  await db.execute("INSERT INTO telemetry_logs (level, msg, meta, ts) VALUES (?, ?, ?, NOW())", [level, msg, JSON.stringify(meta ?? {})]);
}
export async function insertEvent(name: string, payload?: unknown) {
  const db = await getMysql();
  await db.execute("INSERT INTO telemetry_events (name, payload, ts) VALUES (?, ?, NOW())", [name, JSON.stringify(payload ?? {})]);
}