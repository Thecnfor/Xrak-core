# 数据库适配层使用指南

## 命名与获取

- MySQL: `getMySQL()`、`mysqlQuery(sql, params?)`
- Prisma: `getPrisma()`、`prismaHealth()`
- MongoDB: `getMongoClient()`、`getMongoDb()`、`mongoHealth()`
- Redis: `getRedis()`、`redisPing()`
- IndexedDB: `createIndexDB({ name, version, stores })`

## 环境变量

- MySQL: `MYSQL_URL` 或 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DB`
- Prisma: `DATABASE_URL`
- MongoDB: `MONGODB_URI`、`MONGODB_DB`
- Redis: `REDIS_URL`
- 加密: `JWT_SECRET`、`ENCRYPTION_KEY`

## 快速示例

```
// MySQL
import { mysqlQuery, getMySQL } from "./mysql"
await mysqlQuery("SELECT 1")
const pool = getMySQL()
await pool.query("SELECT NOW()")

// Prisma
import { getPrisma, prismaHealth } from "./prisma"
const prisma = getPrisma()
const ok = await prismaHealth()

// MongoDB
import { getMongoDb } from "./mongodb"
const db = await getMongoDb()
await db.collection("posts").findOne({})

// Redis
import { getRedis, redisPing } from "./redis"
const r = await getRedis()
await r.set("k", "v")
await redisPing()

// IndexedDB（浏览器）
import { createIndexDB } from "./indexdb"
const idb = await createIndexDB({
  name: "BlogDB",
  version: 1,
  stores: [
    { name: "offlinePosts", keyPath: "id", indexes: [{ name: "updatedAt", keyPath: "updatedAt" }, { name: "isFavorite", keyPath: "isFavorite" }] },
    { name: "drafts", keyPath: "localId", autoIncrement: true, indexes: [{ name: "postId", keyPath: "postId" }, { name: "lastModified", keyPath: "lastModified" }] },
    { name: "userConfig", keyPath: "key" },
    { name: "syncQueue", keyPath: "id", autoIncrement: true, indexes: [{ name: "timestamp", keyPath: "timestamp" }, { name: "status", keyPath: "status" }] },
    { name: "mediaCache", keyPath: "url", indexes: [{ name: "cachedAt", keyPath: "cachedAt" }, { name: "size", keyPath: "size" }] },
  ],
})
await idb.set("userConfig", "theme", { mode: "dark" })
```

## 设计要点

- 单例缓存：避免开发热更新重复连接
- 惰性初始化：首次调用时连接
- 服务器专用：不要在客户端代码中使用服务端适配器
- IndexedDB 仅在浏览器可用

## 加密工具

```
import { hashPassword, verifyPassword, signJWT, verifyJWT, randomId, encrypt, decrypt } from "../utils/crypto"
const h = await hashPassword("pwd")
await verifyPassword("pwd", h)
const jwt = await signJWT({ sub: "123" })
await verifyJWT(jwt)
const enc = await encrypt(new TextEncoder().encode("text"))
const dec = await decrypt(enc)
```

## Prisma

- Schema 路径：`lib/db/prisma/schema.prisma`
- 生成客户端：`pnpm prisma:generate`
- 迁移：`pnpm prisma:migrate`
- Studio：`pnpm prisma:studio`

## 结构设计总览

- MySQL（主库，Prisma管理）
  - 用户：User（登录、角色、状态、会员等级）
  - 文章：BlogPost（作者、状态、统计）
  - 分类/标签：Category、Tag 多对多关联（PostCategory、PostTag）
  - 评论：Comment（父子评论、状态）
  - 会员：MembershipTier（权益）、UserMembership（有效期与支付信息）
  - 权限：Permission、RolePermission（基于角色的权限映射）
  - 审计：AuditLog（请求摘要与性能指标）
  - 登录历史：LoginHistory（登录行为记录）

- Redis（缓存与会话）
  - `session:{sessionId}`：Hash，24h 过期
  - `online_users`：Set，在线用户ID集合
  - `post:views:{postId}`：Hash，`count`、`lastUpdate`
  - `trending_posts`：ZSet，综合分数排名
  - `user:permissions:{userId}`：Set，权限码集合
  - `post:detail:{postId}`：String(JSON)，1h 过期
  - `post:comments:{postId}`：List，最新评论流
  - `user:config:{userId}`：Hash，键值配置
  - `login:failed:{ip}`：String 计数，15m 过期
  - `rate_limit:{userId}:{action}`：String 计数，按动作限流
  - `latest_posts`：List，最新50篇
  - `category:post_counts`：Hash，各分类文章数

- MongoDB（灵活数据）
  - `user_preferences`：用户个性化配置、布局、通知偏好、书签与阅读历史
  - `post_drafts`：草稿版本控制与编辑元数据
  - `user_analytics`：用户行为分析与会话记录
  - `notifications`：系统通知（已读状态与索引）
  - `audit_details`：审计详情（与 MySQL 审计摘要关联，部分TTL清理）
  - `search_history`：搜索历史

- IndexedDB（浏览器本地，离线支持）
  - `offlinePosts`：离线文章缓存，索引 `updatedAt`、`isFavorite`
  - `drafts`：本地草稿，`postId`、`lastModified` 索引与 `autoIncrement`
  - `userConfig`：本地用户配置KV
  - `syncQueue`：待同步操作队列，索引 `timestamp`、`status`
  - `mediaCache`：媒体文件缓存，索引 `cachedAt`、`size`

## 降级与异步同步策略

- 降级顺序：Redis → MySQL/Prisma → IndexedDB
- 回填策略：命中下层后写回上层缓存（带TTL）
- 同步队列：IndexedDB `syncQueue` 承载离线操作；在线时批量回传；失败重试并记录 `retryCount`
- 冲突解决：对比 `updatedAt`，新者覆盖；必要时标记 `conflict` 交互处理

## 注意事项

- 所有服务端适配器仅在服务器环境使用
- 环境变量严禁暴露到客户端
- 定期清理 Redis 过期与 Mongo TTL 索引集合
- 重要写操作优先落 MySQL/Prisma；Mongo 用于非结构化或高频变更数据

## 分层架构与入口

- 适配器（Adapter）：`mysql.ts`、`prisma.ts`、`mongodb.ts`、`redis.ts`、`indexdb.ts`
- 仓储（Repository）：`repo/user.repo.ts`、`repo/post.repo.ts`、`repo/comment.repo.ts`、`repo/permission.repo.ts`、`repo/audit.repo.ts`
- 服务（Service）：`services/cache.service.ts`、`services/sync.service.ts`
- 键（Keys）：`keys.ts`

## 使用范式

- 文章读取
```
import { postRepo } from "./repo/post.repo"
const post = await postRepo.getById(1001)
```
- 文章更新回填
```
await postRepo.update(1001, { title: "t" })
```
- 用户权限与偏好
```
import { userRepo } from "./repo/user.repo"
const isAdmin = await userRepo.isAdmin(1)
const prefs = await userRepo.getPreferences(1)
```
- 缓存工具
```
import { getOrSet } from "./services/cache.service"
const data = await getOrSet("key", 3600, async () => fetchData())
```
- 浏览器同步队列
```
import { syncService } from "./services/sync.service"
syncService.enqueue("updateUserConfig", { userId: 1, theme: "dark" }, "HIGH")
```

## 一页速览

- 角色分工：
- MySQL/Prisma 负责结构化核心数据与事务
- Redis 负责会话、热数据缓存、限流与排行榜
- MongoDB 存个性化配置、审计详情、草稿与分析
- IndexedDB 在浏览器侧做离线缓存与同步队列

- 入口路径：
- 适配器：`lib/db/mysql.ts`、`lib/db/prisma.ts`、`lib/db/mongodb.ts`、`lib/db/redis.ts`、`lib/db/indexdb.ts`
- 仓储：`lib/db/repo/*`（`userRepo`、`postRepo`、`commentRepo`、`permissionRepo`、`auditRepo`）
- 服务：`lib/db/services/*`（`cache.service`、`sync.service`）
- 键：`lib/db/keys.ts`

- 常用调用：
- 读文章：`await postRepo.getById(1001)`
- 写文章并回填：`await postRepo.update(1001, { title: '新标题' })`
- 查偏好：`await userRepo.getPreferences(1)` / 存偏好：`await userRepo.savePreferences(1, payload)`
- 管理员检查：`await userRepo.isAdmin(1)`
- 限流：`await rateLimit(Keys.rateLimit(1, 'post_create'), 10, 3600)`
- 队列入库：`await syncService.enqueue('updateUserConfig', { userId: 1 }, 'HIGH')`

- 策略速记：
- 读取降级：Redis → MySQL/Prisma → IndexedDB（命中下层即回填上层）
- 同步队列：IndexedDB `syncQueue` 承载离线操作，在线批量上行，失败重试
- 冲突处理：比较 `updatedAt`，较新覆盖；必要时标记 `conflict`