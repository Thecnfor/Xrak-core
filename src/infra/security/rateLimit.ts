import { getRedis } from "@infra/db/redis";
import { getLoginRateLimitConfig } from "./config";
export async function checkLoginRateLimit(email: string, ip: string) {
  const c = await getRedis();
  const conf = await getLoginRateLimitConfig();
  const k = `rl:login:${email}:${ip}`;
  const v = await c.incr(k);
  if (v === 1) await c.expire(k, conf.windowSec);
  return v <= conf.max;
}