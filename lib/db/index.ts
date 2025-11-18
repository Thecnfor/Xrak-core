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
import { categoryRepo } from "./repo/category.repo"
import { tagRepo } from "./repo/tag.repo"
import { membershipRepo } from "./repo/membership.repo"

import { getOrSet, jsonGet, jsonSet, incrWithExpire, rateLimit } from "./services/cache.service"
import { syncService } from "./services/sync.service"

import { Keys } from "./core/keys"
import { MYSQL, MONGO, REDIS, TTL, INDEXDB } from "./core/config"
import { verifyPassword, signJWT, randomId } from "../utils/crypto"

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
  categoryRepo,
  tagRepo,
  membershipRepo,
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
export { categoryRepo, tagRepo, membershipRepo }
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

export const API = {
  users: {
    create: userRepo.create,
    findByEmail: userRepo.findByEmail,
    findById: userRepo.findById,
    isAdmin: userRepo.isAdmin,
    recordLogin: userRepo.recordLogin,
    getPreferences: userRepo.getPreferences,
    savePreferences: userRepo.savePreferences,
    setSession: userRepo.setSession,
  },
  posts: {
    create: postRepo.create,
    getById: postRepo.getById,
    findBySlug: postRepo.findBySlug,
    update: postRepo.update,
    listByAuthor: postRepo.listByAuthor,
    addCategory: postRepo.addCategory,
    removeCategory: postRepo.removeCategory,
    addTag: postRepo.addTag,
    removeTag: postRepo.removeTag,
    incrementView: postRepo.incrementView,
    setTrendingScore: postRepo.setTrendingScore,
    incrementTrending: postRepo.incrementTrending,
    topTrending: postRepo.topTrending,
  },
  comments: {
    create: commentRepo.create,
    listByPost: commentRepo.listByPost,
    remove: commentRepo.remove,
    updateStatus: commentRepo.updateStatus,
  },
  categories: {
    create: categoryRepo.create,
    findById: categoryRepo.findById,
    findBySlug: categoryRepo.findBySlug,
    list: categoryRepo.list,
    update: categoryRepo.update,
    attachToPost: categoryRepo.attachToPost,
    detachFromPost: categoryRepo.detachFromPost,
  },
  tags: {
    create: tagRepo.create,
    findById: tagRepo.findById,
    findBySlug: tagRepo.findBySlug,
    list: tagRepo.list,
    update: tagRepo.update,
    attachToPost: tagRepo.attachToPost,
    detachFromPost: tagRepo.detachFromPost,
  },
  memberships: {
    listTiers: membershipRepo.listTiers,
    createTier: membershipRepo.createTier,
    updateTier: membershipRepo.updateTier,
    removeTier: membershipRepo.removeTier,
    assignMembership: membershipRepo.assignMembership,
    getActiveMembership: membershipRepo.getActiveMembership,
    deactivateMembership: membershipRepo.deactivateMembership,
  },
  permissions: {
    listByRole: permissionRepo.listByRole,
  },
  audit: {
    logSummary: auditRepo.logSummary,
    logDetail: auditRepo.logDetail,
  },
}

/**
 * 复合用例：跨多个存储的业务流程封装
 * 使用示例：
 * const result = await UseCases.auth.signIn("test@example.com", "pwd", { ip: "1.2.3.4", ua: "Mozilla" })
 * await UseCases.profile.saveUserPreferences(1, { theme: "dark" })
 * const post = await UseCases.posts.createWithRelations({ authorId: 1, title: "t", slug: "t", content: "..." }, [1], [2,3])
 */
export const UseCases = {
  /** 登录流程：Prisma 校验用户、Redis 记录限流与会话、MySQL 记录登录历史、Prisma 更新 lastLoginAt、审计摘要 */
  auth: {
    async signIn(email: string, password: string, meta?: { ip?: string; ua?: string; location?: string }) {
      const prisma = DB.prisma.getPrisma()
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, role: true } })
      await DB.redis.getRedis()
      const ip = meta?.ip ?? ""
      if (!(await verifyPassword(password, user?.passwordHash ?? ""))) {
        if (ip) await Services.cache.incrWithExpire(Keys.loginFailed(ip), 900)
        await API.users.recordLogin(user?.id ?? 0, { ip, ua: meta?.ua, location: meta?.location, status: "failed", reason: "invalid_credentials" })
        await API.audit.logSummary({ action: "sign_in", module: "auth", ipAddress: ip, userAgent: meta?.ua, responseStatus: 401 })
        return null
      }
      const sessionId = randomId()
      const token = await signJWT({ sub: String(user?.id), role: user?.role })
      await API.users.setSession(sessionId, { uid: user?.id, role: user?.role, token }, TTL.SESSION)
      await prisma.user.update({ where: { id: user!.id }, data: { lastLoginAt: new Date() } })
      await API.users.recordLogin(user!.id, { ip, ua: meta?.ua, location: meta?.location, status: "success" })
      await API.audit.logSummary({ userId: user!.id, action: "sign_in", module: "auth", ipAddress: ip, userAgent: meta?.ua, responseStatus: 200 })
      return { token, sessionId, userId: user!.id, role: user!.role }
    },
  },
  /** 偏好保存：Mongo 写入并回填 Redis 缓存、审计摘要 */
  profile: {
    async saveUserPreferences(userId: number, preferences: Record<string, unknown>) {
      const saved = await API.users.savePreferences(userId, preferences)
      const r = await DB.redis.getRedis()
      await r.hSet(Keys.userConfig(userId), Object.fromEntries(Object.entries(preferences).map(([k, v]) => [k, JSON.stringify(v)])))
      await API.audit.logSummary({ userId, action: "save_preferences", module: "profile", responseStatus: 200 })
      return saved
    },
  },
  /** 文章创建含分类与标签：Prisma 创建、关联，多端缓存与榜单更新、审计摘要 */
  posts: {
    async createWithRelations(data: { authorId: number; title: string; slug: string; content: string; summary?: string; coverImage?: string; status?: "draft" | "published" | "archived" }, categoryIds: readonly number[] = [], tagIds: readonly number[] = []) {
      const post = await API.posts.create({ ...data })
      for (const cid of categoryIds) await API.posts.addCategory(post.id, cid)
      for (const tid of tagIds) await API.posts.addTag(post.id, tid)
      await Services.cache.jsonSet(Keys.postDetail(post.id), post, TTL.POST_DETAIL)
      await API.posts.setTrendingScore(post.id, 0)
      await API.audit.logSummary({ userId: data.authorId, action: "create_post", module: "post", requestParams: { categoryIds, tagIds, slug: data.slug }, responseStatus: 200 })
      return post
    },
  },
  /** 通用限流执行器：Redis 限流通过后执行，并写审计 */
  rateLimited: {
    async run(userId: number, action: string, limit: number, windowSeconds: number, exec: () => Promise<unknown>) {
      const allowed = await Services.cache.rateLimit(Keys.rateLimit(userId, action), limit, windowSeconds)
      await API.audit.logSummary({ userId, action, module: "rate_limited", responseStatus: allowed ? 200 : 429 })
      if (!allowed) return { ok: false, error: "rate_limited" }
      const out = await exec()
      return { ok: true, data: out }
    },
  },
}