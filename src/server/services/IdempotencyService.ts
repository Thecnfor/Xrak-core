import { getMysql } from "@infra/db/mysql";
export async function ensureOnce(scope: string, key: string) {
  const db = await getMysql();
  const full = `${scope}:${key}`;
  const r = await db.execute("INSERT IGNORE INTO config_kv (`key`, `value`, updated_at) VALUES (?, ?, NOW())", [full, JSON.stringify({ ts: Date.now() })]);
  const info = r[0] as { affectedRows?: number };
  return (info?.affectedRows ?? 0) > 0;
}