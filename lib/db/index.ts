/**
 * DB 层聚合入口：统一导出适配器、仓储、服务与键，便于集中引用
 * 用法示例：
 * import { DB, Repo, Services, Keys } from "./lib/db"
 * const ok = await DB.prisma.prismaHealth()
 * const post = await Repo.postRepo.getById(1001)
 * const limited = await Services.cache.rateLimit(Keys.rateLimit(1, "post_create"), 10, 3600)
 */

import { getMySQL, mysqlQuery } from "./adapters/mysql"
import { getPrisma, prismaHealth } from "./adapters/prisma"
import { getMongoClient, getMongoDb, mongoHealth } from "./adapters/mongodb"
import { getRedis, redisPing } from "./adapters/redis"
import { createIndexDB } from "./adapters/indexdb"

import { userRepo } from "./repo/user.repo"
import { postRepo } from "./repo/post.repo"
import { commentRepo } from "./repo/comment.repo"
import { permissionRepo } from "./repo/permission.repo"
import { auditRepo } from "./repo/audit.repo"

import { getOrSet, jsonGet, jsonSet, incrWithExpire, rateLimit } from "./services/cache.service"
import { syncService } from "./services/sync.service"

import { Keys } from "./core/keys"
import { MYSQL, MONGO, REDIS, TTL, INDEXDB } from "./core/config"

/** 适配器分组：统一管理连接与健康检查 */
export const DB = {
  mysql: { getMySQL, mysqlQuery },
  prisma: { getPrisma, prismaHealth },
  mongo: { getMongoClient, getMongoDb, mongoHealth },
  redis: { getRedis, redisPing },
  indexdb: { createIndexDB },
}

/** 仓储分组：面向领域的读写操作 */
export const Repo = {
  userRepo,
  postRepo,
  commentRepo,
  permissionRepo,
  auditRepo,
}

/** 服务分组：缓存工具与浏览器同步队列 */
export const Services = {
  cache: { getOrSet, jsonGet, jsonSet, incrWithExpire, rateLimit },
  syncService,
}

/** 键生成器：Redis 等键空间约定统一出口 */
export { Keys }

/** 配置分组：统一暴露环境与TTL等配置 */
export const Config = {
  MYSQL,
  MONGO,
  REDIS,
  TTL,
  INDEXDB,
}

/** 透出原始命名导出，保留细粒度调用能力 */
export { getMySQL, mysqlQuery, getPrisma, prismaHealth, getMongoClient, getMongoDb, mongoHealth, getRedis, redisPing, createIndexDB }
export { userRepo, postRepo, commentRepo, permissionRepo, auditRepo }
export { getOrSet, jsonGet, jsonSet, incrWithExpire, rateLimit, syncService }

/** 类型导出 */
export type { IndexDB } from "./adapters/indexdb"
export type { MySQLAdapter, RedisAdapter, MongoAdapter, PrismaHealth } from "./core/types"

/** 健康检查聚合：一次性返回各适配器状态 */
export type HealthSummary = {
  mysql: boolean
  prisma: boolean
  mongo: boolean
  redis: boolean
  indexdb: boolean | "client-only"
}

export async function healthAll(): Promise<HealthSummary> {
  let mysqlOK = false
  try {
    await mysqlQuery("SELECT 1")
    mysqlOK = true
  } catch {
    mysqlOK = false
  }
  const prismaOK = (await prismaHealth()).ok
  const mongoOK = await mongoHealth()
  let redisOK = false
  try {
    redisOK = (await redisPing()) === "PONG"
  } catch {
    redisOK = false
  }
  const indexdbOK = typeof window === "undefined" ? "client-only" : true
  return { mysql: mysqlOK, prisma: prismaOK, mongo: mongoOK, redis: redisOK, indexdb: indexdbOK }
}