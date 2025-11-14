import type { Middleware } from "./compose";
export const securityHeaders: Middleware = async (ctx, next) => {
  await next();
  const res = ctx.res;
  if (!res) return;
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "no-referrer");
  res.headers.set("x-content-type-options", "nosniff");
};