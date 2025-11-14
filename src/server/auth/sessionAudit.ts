import { getMysql } from "@infra/db/mysql";
export async function recordSessionIssued(userId: number, sessionId: string, meta: Record<string, unknown>) {
  const db = await getMysql();
  await db.execute(
    "INSERT INTO auth_session_audit (userId, sessionId, event, meta, ts) VALUES (?, ?, ?, ?, NOW())",
    [userId, sessionId, "issue", JSON.stringify(meta)]
  );
}
export async function recordSessionRevoked(sessionId: string) {
  const db = await getMysql();
  await db.execute(
    "INSERT INTO auth_session_audit (userId, sessionId, event, meta, ts) VALUES (?, ?, ?, ?, NOW())",
    [0, sessionId, "revoke", "{}"]
  );
}
export async function recordSessionRefreshed(sessionId: string, meta: Record<string, unknown>) {
  const db = await getMysql();
  await db.execute(
    "INSERT INTO auth_session_audit (userId, sessionId, event, meta, ts) VALUES (?, ?, ?, ?, NOW())",
    [0, sessionId, "refresh", JSON.stringify(meta)]
  );
}
export async function recordLoginFailed(email: string, meta: Record<string, unknown>) {
  const db = await getMysql();
  await db.execute(
    "INSERT INTO auth_session_audit (userId, sessionId, event, meta, ts) VALUES (?, ?, ?, ?, NOW())",
    [0, "", "login_failed", JSON.stringify({ email, ...meta })]
  );
}
export async function recordPasswordChanged(userId: number) {
  const db = await getMysql();
  await db.execute(
    "INSERT INTO auth_session_audit (userId, sessionId, event, meta, ts) VALUES (?, ?, ?, ?, NOW())",
    [userId, "", "password_change", "{}"]
  );
}