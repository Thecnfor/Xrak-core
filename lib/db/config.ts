export const MYSQL = {
  URL: process.env.MYSQL_URL,
  HOST: process.env.MYSQL_HOST,
  PORT: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : undefined,
  USER: process.env.MYSQL_USER,
  PASSWORD: process.env.MYSQL_PASSWORD,
  DB: process.env.MYSQL_DB,
  POOL_CONNECTION_LIMIT: process.env.MYSQL_POOL_CONNECTION_LIMIT ? Number(process.env.MYSQL_POOL_CONNECTION_LIMIT) : 10,
}

export const MONGO = {
  URI: process.env.MONGODB_URI || "",
  DB_NAME: process.env.MONGODB_DB || "",
}

export const REDIS = {
  URL: process.env.REDIS_URL,
}

export const TTL = {
  SESSION: 86400,
  POST_DETAIL: 3600,
}

export const INDEXDB = {
  NAME: "BlogDB",
  VERSION: 1,
}