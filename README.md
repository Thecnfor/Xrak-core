# XRak Core 快速开始

XRak Core 是一个基于 Next.js 16 的全栈 TypeScript 项目，采用 App Router。内置 Tailwind CSS 4、React Query、Zustand，后端使用 MySQL（drizzle-orm + mysql2）、Redis，并提供多类 API 路由与基础设施封装。

## 环境要求
- Node.js >= 20（建议使用官方安装包）
- 包管理器：npm（或与团队约定一致的工具）
- 数据库：MySQL、Redis（可选：MongoDB）

## 快速上手
1. 克隆仓库并进入目录
2. 配置环境变量：在项目根目录创建 `.env`，至少包含：
   - `MYSQL_URL="mysql://user:pass@host:3306/dbname"`
   - `REDIS_URL="redis://:@host:6379"`
   - `MONGO_URL="mongodb://user:pass@host:27017/dbname"`（可选）
   - `LOG_LEVEL="info"`（可设为 `debug` 便于调试）
3. 安装依赖：
   ```bash
   npm install
   ```
4. 开发模式运行：
   ```bash
   npm run dev
   # 浏览器访问 http://localhost:3000
   # 健康检查接口 http://localhost:3000/api/health
   # 健康流(SSE)   http://localhost:3000/api/health/stream
   ```
5. 构建与启动：
   ```bash
   npm run build
   npm run start
   ```

## 常用脚本
- `npm run dev`：开发服务器（Next.js）
- `npm run build`：构建产物
- `npm run start`：生产模式启动
- `npm run lint`：代码规范检查（ESLint 9 / Next 16 规则）
- `npm run typecheck`：TypeScript 类型检查

## 目录结构
- `app/`：Next.js App Router（`layout.tsx`、`page.tsx`、`api/*/route.ts`）
- `src/`
  - `client/`：客户端 Providers、状态与存储、观测
  - `server/`：服务端中间件与服务、认证、数据库适配
  - `core/`：核心配置、数据库 Schema、外部提供者、健康监控
  - `infra/`：基础设施适配（如 `db/mysql.ts`、`db/redis.ts`）
  - `features/`：特性模块（auth、prefs、telemetry、toaster 等）
  - `shared/`：共享类型与纯函数
- `public/`：静态资源（字体、PWA `manifest.webmanifest`、`sw.js`）

## 环境变量与数据库
- MySQL：`MYSQL_URL` 用于连接池（见 `src/infra/db/mysql.ts`）
- Redis：`REDIS_URL` 用于健康检查与会话/限流（见 `app/api/health/*`）
- MongoDB：`MONGO_URL`（如需使用 `src/core/db/mongo.ts`）

### Drizzle ORM（可选）
- 配置文件：`drizzle.config.ts`（方言 `mysql`，Schema 入口 `src/core/db/schema/index.ts`）
- 常见命令（确保 `MYSQL_URL` 已设置）：
  ```bash
  npx drizzle-kit generate
  npx drizzle-kit push
  ```

## 代码约定
- 路径别名（见 `tsconfig.json`）：`@src/*`、`@server/*`、`@client/*`、`@infra/*`、`@features/*`、`@shared/*`
- 分层约束（见 `.eslintrc.json`）：
  - 客户端禁止依赖服务端或基础设施实现
  - 服务端禁止依赖客户端模块
  - `shared` 仅承载类型与纯函数，不得依赖运行时实现

## 常见问题排查
- 启动时报错与数据库有关：确认 `.env` 中 `MYSQL_URL`、`REDIS_URL` 已正确设置且服务可达
- `api/health` 返回降级信息：检查 Redis 连接与健康监控，或使用 `api/health/stream` 观察实时事件
- 样式无效：确认 `postcss.config.mjs` 与 Tailwind CSS 已安装，`app/globals.css` 已引入

## 参考入口
- 页面入口：`app/layout.tsx`、`app/page.tsx`
- 健康检查：`app/api/health/route.ts`、`app/api/health/stream/route.ts`
- 认证示例：`app/api/auth/login/route.ts`、`app/api/auth/logout/route.ts`、`app/api/auth/register/route.ts`

若需深入模块开发，请从 `src/features/*` 与 `app/api/*` 着手，结合分层与约束进行扩展。