import type mysql from "mysql2/promise"
import type { RedisClientType } from "redis"
import type { Db, MongoClient } from "mongodb"

export type MySQLAdapter = {
  get: () => mysql.Pool
  query: <T = unknown>(sql: string, params?: readonly (string | number | boolean | Date | Buffer | null)[] | Readonly<Record<string, string | number | boolean | Date | Buffer | null>>) => Promise<T[]>
  health: () => Promise<boolean>
}

export type RedisAdapter = {
  get: () => Promise<RedisClientType>
  ping: () => Promise<string>
}

export type MongoAdapter = {
  getClient: () => Promise<MongoClient>
  getDb: () => Promise<Db>
  health: () => Promise<boolean>
}

export type PrismaHealth = {
  ok: boolean
}