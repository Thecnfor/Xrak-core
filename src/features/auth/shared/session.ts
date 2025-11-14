export const SESSION_COOKIE_NAME = "sid";
export const SESSION_ID_PREFIX = "s_";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: SESSION_TTL_SECONDS,
};