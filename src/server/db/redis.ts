import { createClient } from "redis";
let client: ReturnType<typeof createClient> | null = null;
export async function getRedis() {
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL });
  client.on("error", () => {});
  await client.connect();
  return client;
}