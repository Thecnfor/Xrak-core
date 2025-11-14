import { createClient } from "redis";
import { getEnv } from "@core/config/env";
let client: ReturnType<typeof createClient> | null = null;
export async function getRedis() {
  if (client) return client;
  client = createClient({ url: getEnv().REDIS_URL });
  client.on("error", () => {});
  await client.connect();
  return client;
}
