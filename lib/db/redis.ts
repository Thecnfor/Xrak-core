import { createClient, RedisClientType } from "redis";

const url = process.env.REDIS_URL;

declare global {
  var __redisClient: RedisClientType | undefined;
}

export async function getRedis(): Promise<RedisClientType> {
  if (!globalThis.__redisClient) {
    const client = createClient({ url });
    await client.connect();
    globalThis.__redisClient = client as RedisClientType;
  }
  return globalThis.__redisClient as RedisClientType;
}

export async function redisPing(): Promise<string> {
  const client = await getRedis();
  return client.ping();
}
