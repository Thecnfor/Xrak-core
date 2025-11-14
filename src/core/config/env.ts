import { z } from "zod";
const EnvSchema = z.object({
  MYSQL_URL: z.string().url(),
  REDIS_URL: z.string(),
  MONGO_URL: z.string().url(),
});
export function getEnv() {
  return EnvSchema.parse({
    MYSQL_URL: process.env.MYSQL_URL,
    REDIS_URL: process.env.REDIS_URL,
    MONGO_URL: process.env.MONGO_URL,
  });
}