import { getRedis } from "@infra/db/redis";
export async function getUaBlacklist() {
  const c = await getRedis();
  return await c.sMembers("ua:blacklist");
}
export async function addUaBlacklist(val: string) {
  const c = await getRedis();
  await c.sAdd("ua:blacklist", val);
}
export async function removeUaBlacklist(val: string) {
  const c = await getRedis();
  await c.sRem("ua:blacklist", val);
}
export async function getLoginRateLimitConfig() {
  const c = await getRedis();
  const raw = await c.hGetAll("login:rl:conf");
  return { windowSec: Number(raw.windowSec || 60), max: Number(raw.max || 5) };
}
export async function setLoginRateLimitConfig(windowSec: number, max: number) {
  const c = await getRedis();
  await c.hSet("login:rl:conf", { windowSec: String(windowSec), max: String(max) });
}
export async function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const c = await getRedis();
  const key = "admins:emails";
  return (await c.sIsMember(key, email)) || false;
}