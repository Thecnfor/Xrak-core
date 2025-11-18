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