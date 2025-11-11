// 安全配置服务：维护 UA 黑名单与登录限流配置（存储于 Redis）
// 说明：供管理 API 与风控模块统一读写配置。

import { getRedisClient } from "@src/services/db/redis";

export type LoginRateLimitConfig = {
  windowSeconds: number;
  maxPerIp: number;
  maxPerEmail: number;
};

const UA_HASH_SET = "security:ua:blacklist";
const UA_RAW_SET = "security:ua:blacklist:raw";
const RL_LOGIN_CFG_KEY = "security:rl:login:config";
const ADMIN_EMAIL_SET = "security:admin:emails";

export async function getUaBlacklist(): Promise<{ hashes: string[]; raw: string[] }> {
  try {
    const rc = await getRedisClient();
    const [hashes, raw] = await Promise.all([rc.sMembers(UA_HASH_SET), rc.sMembers(UA_RAW_SET)]);
    return {
      hashes: Array.isArray(hashes) ? (hashes as string[]) : [],
      raw: Array.isArray(raw) ? (raw as string[]) : [],
    };
  } catch {
    return { hashes: [], raw: [] };
  }
}

export async function addUaBlacklist(input: { hashes?: string[]; raw?: string[] }): Promise<void> {
  try {
    const rc = await getRedisClient();
    const hs = (input.hashes ?? []).filter(Boolean);
    const rs = (input.raw ?? []).filter(Boolean);
    if (hs.length) await rc.sAdd(UA_HASH_SET, ...hs);
    if (rs.length) await rc.sAdd(UA_RAW_SET, ...rs);
  } catch {}
}

export async function removeUaBlacklist(input: { hashes?: string[]; raw?: string[] }): Promise<void> {
  try {
    const rc = await getRedisClient();
    const hs = (input.hashes ?? []).filter(Boolean);
    const rs = (input.raw ?? []).filter(Boolean);
    if (hs.length) await rc.sRem(UA_HASH_SET, ...hs);
    if (rs.length) await rc.sRem(UA_RAW_SET, ...rs);
  } catch {}
}

export async function getLoginRateLimitConfig(): Promise<LoginRateLimitConfig> {
  // 环境变量兜底（便于无 Redis 时仍可工作）
  const envWin = Number(process.env.AUTH_RL_WINDOW_SECONDS || 300);
  const envCap = Number(process.env.AUTH_RL_MAX_ATTEMPTS || 5);
  const fallback: LoginRateLimitConfig = {
    windowSeconds: Number.isFinite(envWin) && envWin > 0 ? envWin : 300,
    maxPerIp: Number.isFinite(envCap) && envCap > 0 ? envCap : 5,
    maxPerEmail: Number.isFinite(envCap) && envCap > 0 ? envCap : 5,
  };
  try {
    const rc = await getRedisClient();
    const raw = await rc.get(RL_LOGIN_CFG_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const cfg: LoginRateLimitConfig = {
      windowSeconds: Number(parsed.windowSeconds) || fallback.windowSeconds,
      maxPerIp: Number(parsed.maxPerIp) || fallback.maxPerIp,
      maxPerEmail: Number(parsed.maxPerEmail) || fallback.maxPerEmail,
    };
    return cfg;
  } catch {
    return fallback;
  }
}

export async function setLoginRateLimitConfig(cfg: LoginRateLimitConfig): Promise<void> {
  try {
    const rc = await getRedisClient();
    const payload = JSON.stringify({
      windowSeconds: cfg.windowSeconds,
      maxPerIp: cfg.maxPerIp,
      maxPerEmail: cfg.maxPerEmail,
    });
    await rc.set(RL_LOGIN_CFG_KEY, payload);
  } catch {}
}

// 管理员邮箱：用于为登录用户注入 admin 角色
export async function isAdminEmail(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  try {
    const rc = await getRedisClient();
    const hit = await rc.sIsMember(ADMIN_EMAIL_SET, email);
    if (typeof hit === "number") return hit === 1; // 兼容不同返回类型
    if (typeof hit === "boolean") return hit;
  } catch {}
  const env = (process.env.ADMIN_EMAILS || "").split(/[,\s]+/).filter(Boolean);
  return env.includes(email);
}