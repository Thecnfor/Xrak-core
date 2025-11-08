import { z } from "zod";

// MySQL 环境变量（支持远程/本地地址，根据 NODE_ENV 切换）
const mysqlEnvSchema = z.object({
  MYSQL_REMOTE_HOST: z.string().min(1, "MYSQL_REMOTE_HOST is required"),
  MYSQL_REMOTE_PORT: z.coerce.number().int().min(1).default(3306),
  MYSQL_LOCAL_HOST: z.string().min(1, "MYSQL_LOCAL_HOST is required"),
  MYSQL_LOCAL_PORT: z.coerce.number().int().min(1).default(3306),
  MYSQL_DATABASE: z.string().min(1, "MYSQL_DATABASE is required"),
  MYSQL_USER: z.string().min(1, "MYSQL_USER is required"),
  MYSQL_PASSWORD: z.string().min(1, "MYSQL_PASSWORD is required"),
});

export type MySQLEnv = z.infer<typeof mysqlEnvSchema> & {
  host: string;
  port: number;
};

export function readMySQLEnv(): MySQLEnv {
  const parsed = mysqlEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Invalid MySQL env configuration: ${issues}`);
  }
  const isProd = process.env.NODE_ENV === "production";
  const host = isProd
    ? parsed.data.MYSQL_LOCAL_HOST
    : parsed.data.MYSQL_REMOTE_HOST;
  const port = isProd
    ? parsed.data.MYSQL_LOCAL_PORT
    : parsed.data.MYSQL_REMOTE_PORT;
  return { ...parsed.data, host, port };
}

// MongoDB 环境变量（同时支持远程/本地地址，根据 NODE_ENV 切换）
const mongoEnvSchema = z.object({
  MONGO_REMOTE_HOST: z.string().min(1, "MONGO_REMOTE_HOST is required"),
  MONGO_REMOTE_PORT: z.coerce.number().int().min(1).default(27017),
  MONGO_LOCAL_HOST: z.string().min(1, "MONGO_LOCAL_HOST is required"),
  MONGO_LOCAL_PORT: z.coerce.number().int().min(1).default(27017),
  MONGO_DATABASE: z.string().min(1, "MONGO_DATABASE is required"),
  MONGO_USER: z.string().min(1, "MONGO_USER is required"),
  MONGO_PASSWORD: z.string().min(1, "MONGO_PASSWORD is required"),
});

export type MongoEnv = z.infer<typeof mongoEnvSchema> & {
  host: string;
  port: number;
};

export function readMongoEnv(): MongoEnv {
  const parsed = mongoEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Invalid Mongo env configuration: ${issues}`);
  }
  const isProd = process.env.NODE_ENV === "production";
  const host = isProd
    ? parsed.data.MONGO_LOCAL_HOST
    : parsed.data.MONGO_REMOTE_HOST;
  const port = isProd
    ? parsed.data.MONGO_LOCAL_PORT
    : parsed.data.MONGO_REMOTE_PORT;
  return { ...parsed.data, host, port };
}

// Redis 环境变量（同时支持远程/本地地址，根据 NODE_ENV 切换）
const redisEnvSchema = z.object({
  REDIS_REMOTE_HOST: z.string().min(1, "REDIS_REMOTE_HOST is required"),
  REDIS_REMOTE_PORT: z.coerce.number().int().min(1).default(6379),
  REDIS_LOCAL_HOST: z.string().min(1, "REDIS_LOCAL_HOST is required"),
  REDIS_LOCAL_PORT: z.coerce.number().int().min(1).default(6379),
  REDIS_PASSWORD: z.string().optional().default(""),
});

export type RedisEnv = z.infer<typeof redisEnvSchema> & {
  host: string;
  port: number;
};

export function readRedisEnv(): RedisEnv {
  const parsed = redisEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Invalid Redis env configuration: ${issues}`);
  }
  const isProd = process.env.NODE_ENV === "production";
  const host = isProd
    ? parsed.data.REDIS_LOCAL_HOST
    : parsed.data.REDIS_REMOTE_HOST;
  const port = isProd
    ? parsed.data.REDIS_LOCAL_PORT
    : parsed.data.REDIS_REMOTE_PORT;
  return { ...parsed.data, host, port };
}
