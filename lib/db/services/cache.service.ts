import { getRedis } from "../adapters/redis"

export async function getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const redis = await getRedis()
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached) as T
  const value = await fetcher()
  await redis.setEx(key, ttl, JSON.stringify(value))
  return value
}

export async function jsonGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis()
  const v = await redis.get(key)
  return v ? (JSON.parse(v) as T) : null
}

export async function jsonSet(key: string, value: unknown, ttl?: number): Promise<void> {
  const redis = await getRedis()
  if (ttl && ttl > 0) await redis.setEx(key, ttl, JSON.stringify(value))
  else await redis.set(key, JSON.stringify(value))
}

export async function incrWithExpire(key: string, expireSeconds: number): Promise<number> {
  const redis = await getRedis()
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, expireSeconds)
  return count
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const redis = await getRedis()
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  return count <= limit
}