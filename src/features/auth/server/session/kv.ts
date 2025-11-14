import { getRedis } from "@infra/db/redis";
import type { SessionContext } from "@shared/types/session";
import { generateCsrfSecret } from "@infra/security/csrf";
import { SESSION_TTL_SECONDS } from "@features/auth/shared/session";
function key(sid: string) {
  return `sess:${sid}`;
}
function idxKey(uid: number) {
  return `sessidx:user:${uid}`;
}
export async function getSession(sid: string): Promise<SessionContext | null> {
  const c = await getRedis();
  const raw = await c.get(key(sid));
  if (!raw) return null;
  const ctx = JSON.parse(raw) as SessionContext;
  if (typeof ctx.expiresAt === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (now >= ctx.expiresAt) {
      await deleteSession(sid);
      return null;
    }
  }
  return ctx;
}
export async function setSession(sid: string, ctx: SessionContext, ttl?: number) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = typeof ttl === "number" && ttl > 0 ? now + ttl : ctx.expiresAt ?? now + SESSION_TTL_SECONDS;
  const toSave: SessionContext = { ...ctx, csrfSecret: ctx.csrfSecret ?? generateCsrfSecret(), issuedAt: ctx.issuedAt ?? now, expiresAt };
  const c = await getRedis();
  await c.set(key(sid), JSON.stringify(toSave), { EX: expiresAt - now });
  if (toSave.userId > 0) await c.sAdd(idxKey(toSave.userId), sid);
}
export async function deleteSession(sid: string) {
  const c = await getRedis();
  const existing = await getSession(sid);
  await c.del(key(sid));
  if (existing && existing.userId > 0) await c.sRem(idxKey(existing.userId), sid);
}
export async function listUserSessionIds(uid: number) {
  const c = await getRedis();
  const ids = await c.sMembers(idxKey(uid));
  return Array.isArray(ids) ? (ids as string[]) : [];
}