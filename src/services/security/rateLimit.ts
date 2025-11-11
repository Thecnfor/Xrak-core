// 登录风控与限流：基于 Redis 的窗口计数与 UA 黑名单
// 说明：避免在客户端直接暴露策略，实现于服务层，仅服务端调用。

import { getRedisClient } from "@src/services/db/redis";
import { getLoginRateLimitConfig } from "@src/services/security/config";

type RateCheckResult = {
  allowed: boolean;
  reason?: "rate_limited" | "ua_denied";
  emailCount?: number;
  ipCount?: number;
};

async function readConfig() {
  // 从 Redis 读取登录限流配置，缺失时使用环境变量兜底
  const cfg = await getLoginRateLimitConfig();
  return cfg;
}

export async function isUserAgentDenied(uaHash?: string, userAgent?: string): Promise<boolean> {
  // 加固：Redis 客户端获取失败时直接返回未拒绝，避免抛错导致上层流程中断
  let rc: Awaited<ReturnType<typeof getRedisClient>> | null = null;
  try {
    rc = await getRedisClient();
  } catch {
    rc = null;
  }
  if (!rc) return false;
  try {
    if (uaHash) {
      const hit = await rc.sIsMember("security:ua:blacklist", uaHash);
      if (hit) return true;
    }
  } catch {}
  try {
    if (userAgent) {
      const hit2 = await rc.sIsMember("security:ua:blacklist:raw", userAgent);
      if (hit2) return true;
    }
  } catch {}
  return false;
}

export async function checkLoginRateLimit(email: string, ip: string): Promise<RateCheckResult> {
  // 加固：若 Redis 客户端不可用则直接放行（返回允许），避免 ECONNREFUSED 抛错
  let rc: Awaited<ReturnType<typeof getRedisClient>> | null = null;
  try {
    rc = await getRedisClient();
  } catch {
    rc = null;
  }
  if (!rc) return { allowed: true };
  const cfg = await readConfig();
  const win = cfg.windowSeconds;
  const capEmail = cfg.maxPerEmail;
  const capIp = cfg.maxPerIp;
  const emailKey = `rl:login:email:${email}`;
  const ipKey = `rl:login:ip:${ip}`;
  try {
    const emailCount = await rc.incr(emailKey);
    if (emailCount === 1) await rc.expire(emailKey, win);
    const ipCount = await rc.incr(ipKey);
    if (ipCount === 1) await rc.expire(ipKey, win);
    const allowed = emailCount <= capEmail && ipCount <= capIp;
    return { allowed, reason: allowed ? undefined : "rate_limited", emailCount, ipCount };
  } catch {
    // Redis 不可用时不阻塞登录流程
    return { allowed: true };
  }
}