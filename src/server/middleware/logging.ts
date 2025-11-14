import type { Middleware } from "./compose";
import { recordRequestLog } from "@server/services/TelemetryService";
export const logging: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const status = ctx.res?.status ?? 0;
  await recordRequestLog({ path: ctx.req.nextUrl.pathname, method: ctx.req.method, status, duration });
};