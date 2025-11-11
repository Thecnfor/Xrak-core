// 服务器端的会话审计记录（配合 cookie+session 与 KV 会话存储）
// 说明：此处不存储会话本体，仅记录发放与撤销事件，用于审计与问题追踪。

import { eq } from "drizzle-orm";
import { getDrizzle } from "@src/services/db/mysql";
import { authSessionAudit } from "@/drizzle/auth";

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("session audit can only run on server");
  }
}

export async function recordSessionIssued(
  userId: number,
  sessionId: string,
  meta?: {
    ip?: string;
    uaHash?: string;
    userAgent?: string;
    country?: string;
    city?: string;
  }
): Promise<void> {
  assertServer();
  const db = await getDrizzle();
  await db.insert(authSessionAudit).values({
    userId,
    sessionId,
    ip: meta?.ip ?? "",
    uaHash: meta?.uaHash ?? "",
    userAgent: meta?.userAgent ?? "",
    country: meta?.country ?? "",
    city: meta?.city ?? "",
  });
}

export async function recordSessionRevoked(sessionId: string): Promise<void> {
  assertServer();
  const db = await getDrizzle();
  await db
    .update(authSessionAudit)
    .set({ revokedAt: new Date() })
    .where(eq(authSessionAudit.sessionId, sessionId));
}
