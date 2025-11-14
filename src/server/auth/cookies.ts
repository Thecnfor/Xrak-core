import { SESSION_COOKIE_OPTIONS } from "@features/auth/shared/session";
export function makeSetCookie(name: string, value: string) {
  const o = SESSION_COOKIE_OPTIONS;
  const parts = [ `${name}=${value}`, `Path=${o.path}`, `HttpOnly`, `SameSite=${o.sameSite}`, `Max-Age=${o.maxAge}` ];
  if (o.secure) parts.push("Secure");
  return parts.join("; ");
}