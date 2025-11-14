import { cookies, headers } from "next/headers";
import { SESSION_COOKIE_NAME } from "@features/auth/shared/session";
import { getSession } from "./session/kv";
import type { SessionContext, Role } from "@shared/types/session";
import { extractCsrfToken, validateCsrfToken } from "@infra/security/csrf";
export async function getAuthFlags(): Promise<{ isLoggedIn: boolean; isAdmin: boolean; session: SessionContext | null; }> {
  const c = await cookies();
  const sid = c.get(SESSION_COOKIE_NAME)?.value;
  const session = sid ? await getSession(sid) : null;
  const isLoggedIn = !!session && (session.userId ?? 0) > 0;
  const isAdmin = !!(session?.isAdmin || session?.roles?.includes?.("admin" as Role));
  return { isLoggedIn, isAdmin, session };
}
export async function getSessionFromCookies() {
  const c = await cookies();
  const sid = c.get(SESSION_COOKIE_NAME)?.value;
  return sid ? await getSession(sid) : null;
}
export async function requireLoggedIn() {
  const s = await getSessionFromCookies();
  if (!s || (s.userId ?? 0) <= 0) throw new Error("unauthorized");
  return s;
}
export function hasRole(session: SessionContext | null | undefined, role: Role) {
  return !!session?.roles?.includes?.(role);
}
export function isAdmin(session: SessionContext | null | undefined) {
  return !!(session?.isAdmin || hasRole(session, "admin" as Role));
}
export async function assertCsrfForWrite(session?: SessionContext | null) {
  const s = session ?? (await getSessionFromCookies());
  const h = await headers();
  const token = extractCsrfToken(h);
  const ok = validateCsrfToken(s?.csrfSecret, token);
  if (!ok) throw new Error("csrf_failed");
}