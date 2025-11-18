import { createClient, RedisClientType } from "redis";
import { REDIS } from "../core/config";

declare global {
  var __redisClient: RedisClientType | undefined;
}

export async function getRedis(): Promise<RedisClientType> {
  if (!globalThis.__redisClient) {
    const client = createClient({ url: REDIS.URL });
    await client.connect();
    globalThis.__redisClient = client as RedisClientType;
  }
  return globalThis.__redisClient as RedisClientType;
}

export async function redisPing(): Promise<string> {
  const client = await getRedis();
  return client.ping();
}
