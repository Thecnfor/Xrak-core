# Xrak-core Provider 使用指南（Edge-first / Serverless / AI-native）

本项目已完成全局包裹栈与基础设施的工程化封装，开发者可在页面与功能模块中直接消费统一的 Provider 与服务层，避免重复初始化或耦合。

## 全局包裹栈（app/layout.tsx）

栈顺序：
- ObservabilityProvider → SessionRoot → Suspense(fallback=null) → AppProviders(locale="zh-CN") → Toaster

职责简述：
- ObservabilityProvider：初始化 OpenTelemetry 与轻量分析，统一封装 posthog-js。
- SessionRoot：在服务端读取 cookies/session 注入到客户端上下文。
- AppProviders：注入主题、React Query、SEO、国际化与吐司。
- Toaster：全局唯一的吐司容器。

注意：严禁在页面或组件内重复创建 QueryClient、重复渲染 Toast 容器或单独初始化分析 SDK。

## 会话与 Cookie（useSession）

类型统一：`src/types/session.ts` 中的 `SessionData`。

常用 API：
- `const { session } = useSession()` 获取当前客户端会话，匿名为 `{ userId: "0" }`。
- `refreshSession()` 调用 `/api/session` 刷新或引导匿名会话（补发 `sid` HttpOnly Cookie）。
- `setClientCookie(name, value, opts)` 写入可见（非 HttpOnly）Cookie，常用于前端调试或偏好设置。

说明：服务端会话通过自建 `redis` 管理（不再使用 `@vercel/kv`），TTL 统一在 `src/config/session.ts`。Cookie 的 `Secure`、`SameSite`、`Path` 等默认值也已集中配置，保证一致性。

### CSRF 与写操作 API

- CSRF 秘钥由服务端在会话写入时自动生成，使用“32 字节高熵随机数 + Base64URL”编码，存储在 KV 的会话对象中（`csrfSecret`），通过 `GET /api/session` 下发到客户端，仅保存在内存，不入 Cookie。
- 客户端在执行敏感写操作时，必须将该秘钥通过请求头 `x-csrf-token` 回传。
- 服务端写接口需要校验：
  1) 读取 Cookie 的 `sid` 并从 KV 获取会话；
  2) 校验当前用户已登录（`userId > 0`）；
  3) 使用常量时间比较的校验方法 `validateCsrfToken(session.csrfSecret, extractCsrfToken(headers))`，降低时序攻击风险。

示例 API（已内置）：
- `POST /api/account/profile`：更新用户昵称（body: `{ displayName: string }`）。
- `POST /api/account/password`：重置用户密码（body: `{ currentPassword: string, newPassword: string }`）。
  - 两者均为 Node 运行时（访问数据库），使用 Hono + Zod，按约定完成 CSRF 与会话校验。

客户端调用示例：
```ts
// 获取 session 后拿到 csrfSecret
const res = await fetch('/api/session');
const { session } = await res.json();
// 写操作时带上 x-csrf-token
await fetch('/api/account/profile', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrfSecret },
  body: JSON.stringify({ displayName: '新昵称' })
});
```

实现细节：
- 生成：`src/utils/csrf.ts` 采用 Web Crypto/Node 的安全随机源，输出为无填充 Base64URL 字符串。
- 校验：采用常量时间字符串比较，避免因字符串差异导致的时序信息泄露。

## 吐司（useToaster）

示例：
```tsx
const { toast } = useToaster();
toast("保存成功", { type: "success" });
```

支持类型：`info | success | warning | error`。

## 主题（useTheme）

示例：
```tsx
const { theme, setTheme } = useTheme();
setTheme("dark"); // "light" | "dark" | "system"
```

## 分析埋点（useAnalytics）

示例：
```tsx
const analytics = useAnalytics();
analytics.capture("user-signup", { plan: "pro" });
```

说明：事件命名采用 kebab-case，PostHog 初始化已在 Provider 内做 StrictMode/HMR 的去重处理。设置 `NEXT_PUBLIC_POSTHOG_KEY` 才会生效。

## 数据获取（React Query）

统一使用 `@tanstack/react-query` 的 hooks；QueryClient 在 `AppProviders` 中全局注入，不需要自行创建。

示例：
```tsx
import { useQuery } from "@tanstack/react-query";

function Profile() {
  const { data, status } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/session");
      return res.json();
    },
  });
  return <pre>{JSON.stringify({ status, data }, null, 2)}</pre>;
}
```

开发模式将自动启用 React Query Devtools；生产环境不注入，保持体积洁净。

## SEO（SEOProvider）

统一通过 `src/utils/seo` 提供的工具方法与 `next-seo` 配置，不在页面内直接手写 meta 标签。营销页可在模块内维护 SEO 配置对象，页面层引入即可。

Sitemap 与 Robots：
- 已提供 `app/sitemap.ts` 与 `app/robots.ts`，基于 Next Metadata Route 输出标准 `sitemap.xml` 与 `robots.txt`。
- `NEXT_PUBLIC_SITE_URL` 用于生成绝对链接与主机名，请在环境变量中正确设置。

## 可观测性（OpenTelemetry）

在 `ObservabilityProvider` 完成基础初始化，采集标准事件与错误边界。若需更细粒度的埋点，请在 `src/observability/analytics/*` 增加事件定义并统一上报。

## Dev 测试页（/app/dev/page.tsx）

在 `/dev` 已集成以下复杂场景测试：
- SSR 显示当前会话（含 `userId/email/displayName`）。
- 列出最近会话审计日志（验证登录/登出行为）。
- 客户端面板：
  - 刷新会话（调用 `/api/session`）。
  - 写入可见 Cookie（`debug=1`）。
  - 主题切换与吐司弹出。
  - PostHog 事件上报示例（匿名/登录）。
  - 我的设备（会话）列表：
    - 展示当前用户的所有会话（含 `sid/uaHash/issuedAt/expiresAt`）。
    - 支持“注销此设备”与“注销全部设备”，会同步清除 Redis 中的会话与审计记录，并在注销当前设备时移除 `sid` Cookie。

设备列表工具：
- `src/utils/sessionDevices.ts` 提供 `getDeviceList(userId)`，基于 KV 索引返回设备摘要。
  - 真实 KV 环境使用 Redis 集合；本地开发无 KV 时自动降级为内存 Map（通过 `globalThis` 共享）。
  - 性能优化：会话上下文读取已并行化；读取时自动清理过期会话，确保设备列表干净。

访问方式：
- 开发：`pnpm dev` 后打开 `http://localhost:3000/dev`
- 构建：`pnpm build`

## 环境变量

- `NEXT_PUBLIC_POSTHOG_KEY`：启用 PostHog 客户端分析。
- `OTEL_EXPORTER_OTLP_ENDPOINT`：OpenTelemetry OTLP HTTP 端点（可选，未配置则跳过初始化）。

### OpenTelemetry 初始化与常见问题（Node 运行时）

- 初始化位置：`instrumentation.ts`（Next 启动阶段调用）与 `src/observability/otel.ts`（安全初始化逻辑）。
- 启用条件：仅在“服务端且非 Edge 运行时”并且 `OTEL_EXPORTER_OTLP_ENDPOINT` 为有效 `http/https` URL 时初始化。
- 环境变量：
  - `OTEL_EXPORTER_OTLP_ENDPOINT`：例如 `https://collector.example.com/v1/traces`。
  - `OTEL_EXPORTER_OTLP_HEADERS`：可选，JSON 字符串，示例：`{"Authorization":"Bearer <token>"}`。
- 终端提示：如出现“OpenTelemetry initialization skipped: Could not parse user-provided export URL: ''”，表示端点为空或非法，初始化被安全跳过，不影响页面渲染。
- 解决方案：
  - 在 `.env.local` 设置有效端点：`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces`。
  - 如暂不接入 OTLP，可保持未配置；初始化会自动跳过且无副作用。

### 会话架构（MySQL + Redis + MongoDB）

- 会话存储：`redis` 负责保存会话上下文（`sid -> SessionContext`），并维护用户会话索引（`sessidx:user:<userId>`）。无 Redis 时本地开发自动降级为进程内存。
- 审计与结构化数据：`mysql` 负责用户表（`users`）与会话审计（`auth_session_audit`），并新增登录尝试记录（`auth_login_attempts`）与用户设备表（`auth_user_devices`）。
- 文档/扩展：`mongodb` 预留做非结构化扩展（画像、偏好、活动日志等）；默认仅封装连接，不在仓库内写入具体逻辑。
- 封装约定：所有数据库客户端统一封装在 `src/services/db/*.ts`，仅导出连接与健康检查，不包含业务逻辑；业务访问通过服务层在 Server 组件或 API 路由中调用。

### 环境变量键（示例）

- MySQL：`MYSQL_REMOTE_HOST`、`MYSQL_REMOTE_PORT`、`MYSQL_LOCAL_HOST`、`MYSQL_LOCAL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`
- Redis：`REDIS_REMOTE_HOST`、`REDIS_REMOTE_PORT`、`REDIS_LOCAL_HOST`、`REDIS_LOCAL_PORT`、`REDIS_PASSWORD`
- MongoDB：`MONGO_REMOTE_HOST`、`MONGO_REMOTE_PORT`、`MONGO_LOCAL_HOST`、`MONGO_LOCAL_PORT`、`MONGO_DATABASE`、`MONGO_USER`、`MONGO_PASSWORD`

环境选择约定：
- 数据库/缓存等服务的环境变量解析统一在 `src/services/db/env.ts` 内实现。
- 开发环境使用远程地址（`*_REMOTE_*`），生产环境使用本地地址（`*_LOCAL_*`），与现有测试用例保持一致。
- Redis 缺失时，会话自动降级为进程内存（仅用于本地开发）。

## API 约定

- 边缘/Serverless API 使用 `hono`，所有输入输出通过 `zod` 校验（按模块补充）。
- 会话刷新：`GET /api/session`，首次访问将自动分配匿名会话并补发 HttpOnly Cookie（会话本体存储在 Redis）。
- 用户资料修改：`POST /api/account/profile`（需要 `x-csrf-token`）。
- 用户密码重置：`POST /api/account/password`（需要 `x-csrf-token`）。

错误响应格式（统一）：
- `400 invalid_input`：`{ error: "invalid_input", details: ZodError.flatten() }`
- `401 unauthorized`：`{ error: "unauthorized" }`
- `403 forbidden`：`{ error: "forbidden" }`
- `404 not_found`：`{ error: "not_found" }`
- `500 server_error`：`{ error: "server_error" }`

## 架构核查结论与下一阶段指南（Provider 准备）

为保证 Edge-first、Serverless 与 AI-native 的一致性，已对当前实现进行一次自检，结论与改进点如下，便于进入“各类 Provider 准备与扩展”的下一阶段。

### 架构概览（与实现对齐）
- 全局栈位于 `app/layout.tsx`，顺序：`ObservabilityProvider → SessionRoot → Suspense(fallback=null) → AppProviders(locale="zh-CN") → Toaster`。
- Provider 统一入口：`src/lib/providers/index.ts`，集中 re-export，保持模块职责清晰。
- 具体 Provider 构成：
  - `AppProviders`（`src/lib/providers/AppProviders.tsx`）：封装主题、React Query、分析、吐司与 SEO，开发环境自动启用 React Query Devtools。
  - `SessionRoot`（Server 组件）：在服务端读取 `cookies` 与 KV 会话（`src/services/session/kv.ts`），为 `SessionProvider` 构造初始值，并在客户端挂载 `SessionBootstrap` 刷新会话与上报分析事件。
  - `SessionProvider`：统一 `useSession` 客户端上下文（含 `refreshSession`、`setClientCookie` 等）。
  - `ToasterProvider` + `src/features/toaster/Toaster.tsx`：全局唯一的吐司容器与上下文 API。
  - `ThemeProvider`：统一暗/明/系统主题切换，响应系统偏好变化。
  - `QueryProvider`：全局 `QueryClient`（开发模式注入 Devtools）。
  - `SEOProvider`：轻量 SEO 上下文（营销页通过 `next-seo` 配置）。
  - `ObservabilityProvider`：客户端错误边界；服务端 OTLP 初始化在 `src/observability/otel.ts`（仅非 Edge 运行时且配置了端点时启用）。

### 一致性与边界检查
- API 捕获路由：`app/api/[...hono]/route.ts` 已统一 `/api/*`，对数据库能力声明 `runtime = "nodejs"`；读会话与纯校验路径保持 Edge 兼容。
- 会话层：`src/services/session/kv.ts` 优先 Redis，缺失时降级进程内存（通过 `globalThis` 共享），读取时自动清理过期；设备索引提供 `sessidx:user:<userId>`。
- 导入与别名：仓库已配置 `@src/*` 与 `@/*` 别名；建议统一引用 `src` 下模块使用 `@src/*`，根目录内容（如 `drizzle/*`）使用 `@/*`，避免在同一文件中混用或使用相对路径。
- 可观测性：`src/observability/otel.ts` 仅在 Node 运行时初始化，Edge 环境自动跳过；客户端错误边界不引入第三方依赖，便于最小开销。

### 管理后台 API（角色与等级）

- 路由统一在 `app/api/[...hono]/route.ts`，需管理员权限（会话 `isAdmin` 或管理员邮箱白名单）。
- 接口：
  - `PUT /api/admin/users/:id/roles`：请求体 `{ roles?: ("admin"|"user")[], isAdmin?: boolean }` 。仅持久化 `users.is_admin`，`roles` 作为会话补充类型使用。
  - `PUT /api/admin/users/:id/levels`：请求体 `{ userLevel?: number, vipLevel?: number }`。持久化 `users.user_level` 与 `users.vip_level`。
- 审计：
  - 新表 `admin_audit_logs`（`drizzle/auth.ts`），记录管理员对用户的角色/等级变更：`admin_user_id/target_user_id/action/detail_json/created_at`。
  - 两接口均写入审计日志，便于追踪变更来源与内容。
- 会话更新：
  - 持久化变更会在用户下一次刷新或重新登录后反映；如需实时生效，建议新增“会话踢出/重建”API 并在管理端触发。

### 页面级 SEO 与站点地图

- 页面使用 `generateMetadata()` 并调用 `src/utils/seo.ts` 的 `generatePageMetadata(defaultSEOConfig, { title, description, path, images })`，保持风格一致。
- 站点地图：项目根提供 `next-sitemap.config.js`；CI 中执行 `pnpm next-sitemap` 可生成 `public/sitemap.xml` 与 `public/robots.txt`。
- 根布局单独导出 `viewport`，避免在 `metadata` 中设置 `viewport/themeColor` 造成构建警告。
- 分析 SDK：当前 `AnalyticsProvider` 提供空实现（`ready=false`），符合“暂不接入第三方分析 SDK”的约定；后续若启用 `posthog-js`，需在此处统一封装并做 StrictMode/HMR 去重。

### 发现的问题与改进建议（不影响当前阶段开发）
- 导入路径不一致：`app/layout.tsx` 与个别 Provider 内存在对 `src/*` 的相对路径导入；建议统一改为别名（`@src/*`）以提升可维护性。
- 注释语言一致性：个别文件存在英文注释（如 `src/observability/Provider.tsx`）；按仓库约定应改为中文注释，避免混用。
- SEO 集成说明可更明确：`next-seo` 作为营销页配置入口，建议在模块层定义配置对象并在页面引入，避免页面内手写 meta。
- Provider 扩展入口：确保所有新 Provider 通过 `src/lib/providers` 扩展并由 `AppProviders` 注入，避免在页面层私自实例化上下文（当前实现已符合）。

以上改进点将作为后续 PR 的清理项；不影响“Provider 准备”阶段的推进。

### Provider 扩展开发指南（强约定）
1) 新建 Provider：在 `src/lib/providers` 目录新增 `<Name>Provider.tsx` 与对应的 `use<Name>()` Hook；仅做上下文与最小业务封装，不在此处写具体业务逻辑。
2) 统一入口导出：在 `src/lib/providers/index.ts` 中 re-export 新 Provider 与 Hook。
3) 全局注入：在 `src/lib/providers/AppProviders.tsx` 中以最小包裹注入，遵循既有顺序与职责边界；不得在页面或功能模块内重复初始化。
4) 客户端/服务端边界：
   - 需要读取 `cookies/session` 的部分通过 `SessionRoot` 在服务端预取，仅在客户端消费 `SessionProvider`。
   - 引入 Node-only 能力（数据库/Redis/argon2 等）仅允许在 Server 组件或 API 路由中；客户端 Provider 禁止直接访问这些能力。
5) SEO 与分析：
   - SEO 统一通过 `src/utils/seo`；营销页定义 `next-seo` 配置对象后在页面层引入，不手写 meta。
   - 分析事件统一通过 `useAnalytics()` 上报；启用第三方 SDK 时仅在该 Provider 内完成初始化与防重。
6) 测试与质量：
   - 单元测试（`vitest`）覆盖上下文默认值、边界行为与副作用（如主题切换、会话刷新）。
   - E2E（`@playwright/test`）在 `/dev` 测试页走一遍 Provider 全流程：会话刷新、吐司、主题切换与设备列表。

### 扩展示例（新增 Provider）
- 场景：新增权限控制 Provider（`PermissionProvider`），统一维护角色与资源权限校验。
- 步骤：
  - 在 `src/lib/providers/PermissionProvider.tsx` 创建上下文与 `usePermission()` Hook，输入 `roles` 与资源枚举，提供 `can(resource)` 方法。
  - 在 `src/lib/providers/index.ts` 暴露 Provider 与 Hook。
  - 在 `AppProviders` 注入 `PermissionProvider`（数据来源通过 `useSession()` 读取用户角色，禁止客户端直连数据库）。
  - 编写 `vitest` 用例验证角色切换与边界情况。

---

## API 路由统一模式与扩展指南

- 单一入口：`app/api/[...hono]/route.ts` 作为 `/api/*` 的统一捕获路由，避免分散目录与重复中间件。
- 运行时选择：对涉及数据库的路由使用 `runtime = "nodejs"`；纯校验与会话读取保持 Edge 兼容（避免 Node-only API）。
- 中间件顺序：`解析 Cookie → 加载会话 → 写操作校验（CSRF）→ 权限校验 → 业务处理 → 统一错误响应`。
- 校验与类型：所有输入输出通过 `zod` 校验；错误按统一格式返回，便于前端与测试用例稳定断言。
- 导入规范：统一使用 `@src/*` 引用 `src` 下模块；引用根目录内容（如 `drizzle/*`）使用 `@/*`。
- 兼容旧路径：保持 `/api/session`、`/api/account/profile`、`/api/account/password` 等原有路径不变，内部在捕获路由中映射。
- 新增路由步骤：
  - 在 `route.ts` 内新增分组：`app.route('/api/xxx', (r) => { ... })`。
  - 定义 `zod` schema 并在处理器中校验 `ctx.req.json()` 或 query 参数。
  - 若为写操作，读取头 `x-csrf-token` 并使用 `validateCsrfToken()` 校验；会话与权限使用服务层方法统一处理。
  - 使用 `getDrizzle()` 访问 MySQL，表结构统一在 `drizzle/*`（示例：`drizzle/auth.ts` 的 `users` 表）。

### 占位路由兼容与代理（Next 16 构建类型校验）

- 保留占位文件：`app/api/*/route.ts` 仍需存在以满足 Next 的类型存在性检查，但不重复实现逻辑。
- 统一代理：新增 `app/api/routeProxy.ts`，集中复用捕获路由导出：

  ```ts
  // app/api/routeProxy.ts
  export { GET, POST, PUT } from './[...hono]/route'
  ```

- 子路由占位写法统一：按层级从代理转发，保留运行时声明。

  ```ts
  // app/api/session/route.ts（一级目录）
  export const runtime = 'nodejs'
  export { GET } from '../routeProxy'

  // app/api/account/password/route.ts（两级目录）
  export const runtime = 'nodejs'
  export { POST } from '../../routeProxy'
  ```

- 目的：避免在多个占位文件中重复 `export { GET/POST/PUT } from '[...hono]/route'` 的相对路径差异，提升可维护性。
- 测试建议：
  - 单元测试：使用 `vitest` 对输入校验与权限分支做白盒测试（分别覆盖成功、失败与边界情况）。
  - 端到端：使用 `@playwright/test` 从注册→登录→写操作（带 CSRF）→分页等完整路径，确保 `/dev` 测试页不报错。
- 性能与安全：
  - 常量时间比较校验 CSRF，避免时序攻击；写操作均需会话登录态。
  - 统一限速与 UA 黑名单配置在管理员路由下集中管理，避免散落在各处。

### 与 Drizzle 的一致性检查
- 连接封装：通过 `src/services/db/mysql.ts` 的 `getDrizzle()` 获取 Drizzle 客户端，禁止在路由中直接创建连接池。
- 表结构来源：从 `drizzle/auth.ts` 导入 `users` 等表对象，查询与更新统一使用 Drizzle 的查询构造器，避免拼接 SQL。
- 错误处理：数据库异常统一捕获并转换为 `500 server_error`；输入校验失败返回 `400 invalid_input`。
- 索引与约束：请确保 `users.email` 有唯一索引以避免重复；登录查询采用精确匹配并走索引路径，减少不必要的全表扫描。

### 目录优化与冗余约定（src）
- 别名统一：全仓库统一使用 `@src/*` 引用 `src` 目录；避免同文件混用 `@src` 与 `@/src`。
- Barrel 导出：服务层与 Provider 已提供统一入口（如 `src/services/db/index.ts`、`src/lib/providers/index.ts`），优先从入口导入，避免跨文件跳转与重复路径。
- 逻辑边界：`src/services/*` 仅做连接与服务封装，不写入业务逻辑；业务逻辑在 API 路由或 Server 组件中组合调用服务层。
- 可观测性：统一在 `src/observability/*`，不要在页面层散落初始化；分析事件通过 `src/observability/analytics/*` 统一定义与上报。

### 扩展示例（新增 /api/account/email）
- 场景：用户修改邮箱（需要登录与 CSRF）。
- 步骤：
  - 在 `app/api/[...hono]/route.ts` 中添加分组 `/api/account/email`，定义 `zod` schema：`{ newEmail: string }` 并校验格式。
  - 从会话中读取 `userId`，校验 `x-csrf-token`，使用 `getDrizzle()` 更新 `users.email`（注意唯一约束与冲突处理）。
  - 响应统一：成功返回 `{ ok: true }`；冲突返回 `400 invalid_input` 并包含字段级错误说明。


## 注意事项与最佳实践

- 不要在页面或组件内直接初始化 SDK（posthog、QueryClient 等），统一通过 Provider 注入。
- 客户端状态统一使用 `zustand`，表单使用 `react-hook-form` + `zod` resolver。
- 数据访问通过服务层封装（`src/services/*`），仅在 Server 组件或 API 路由中消费。
- `redis` 用于缓存与会话；如需延时任务后续统一封装（当前不接入 QStash）。
- 写操作 API 必须接入 CSRF 校验；客户端需从 `/api/session` 获取 `csrfSecret` 并在写请求头中携带 `x-csrf-token`。

---

如需扩展 Provider（国际化、权限控制、主题扩展等），请在 `src/lib/providers` 目录新增并在 `AppProviders` 注入，保持全局一致性与可维护性。

## 目录结构与职责（标准化）

- `app/*`：Next.js App Router 页面与路由；仅消费 Provider 与服务层。
- `src/features/*`：业务模块的 UI 组件与逻辑（每个模块自包含 `components`）。
- `src/services/*`：服务层封装（如 `db/` 连接、API 封装、外部 SDK 代理），无业务逻辑泄露。
- `src/store/*`：客户端状态（`zustand`）。
- `src/utils/*`：跨模块工具方法（如 `cn.ts`、`csrf.ts`、`sessionDevices.ts`、`seo/*`）。
- `src/lib/providers/*`：全局与模块 Provider（`AppProviders`、`SessionRoot`、`QueryProvider`、`ThemeProvider`、`ToasterProvider`、`AnalyticsProvider`）。
- `src/types/*`：类型定义与接口（如 `session.ts`）。
- `src/observability/*`：可观测性（`otel.ts`、`server.ts`、`analytics/*`）。

结构化约定：
- 全局栈位于 `app/layout.tsx`，顺序为：`ObservabilityProvider → SessionRoot → Suspense(fallback=null) → AppProviders(locale="zh-CN") → Toaster`。
- 数据访问通过 `src/services/*`，禁止在客户端直接连接数据库。
- 新增模块请归入上述既有目录，不要在 `src` 下随意新建目录；如需扩展，请在 README 补充约定说明并与现有结构保持一致。

### 导入规范与路径别名

- 已配置 `tsconfig.json`：`baseUrl` 为项目根；别名 `@/*` 指向项目根，`@src/*` 指向 `src/*`。
- 示例导入：
  - `import { AppProviders, SessionRoot } from "@src/lib/providers"`
  - `import { cn } from "@src/utils/cn"`

### Provider 统一入口使用示例

- 引入统一入口：`import { AppProviders, SessionRoot } from "@src/lib/providers"`。
- 页面结构遵循全局栈：在 `app/layout.tsx` 仅使用统一入口导出，避免跨文件散乱导入。

## 快速建表（Drizzle 迁移）

本仓库采用 Drizzle ORM 的迁移机制管理 MySQL 表结构与索引，禁止通过代码手写 `CREATE TABLE`。请按以下方式快速创建/修复认证相关的三张表：

涉及表（定义见 `drizzle/auth.ts`）：
- `users`
- `auth_session_audit`
- `auth_login_attempts`

方式一：通过 Dev 页执行（开发/本地推荐）
- 打开 Dev 测试页：`http://localhost:3000/dev`
- 在“认证结构与索引”区域点击按钮“执行 Drizzle 迁移（快速建表/修复）”，调用服务端动作 `runDrizzleMigrations()` 程序化执行 `drizzle/migrations` 目录下的 SQL 文件，确保与生产一致。

方式二：CLI（CI/生产推荐）
1) 生成迁移文件（当你修改了 `drizzle/auth.ts` 的表结构时）：
   - 运行：`pnpm drizzle-kit generate`
   - 说明：该命令读取 `drizzle.config.ts`，在 `drizzle/migrations/` 生成增量 SQL 文件，并更新 `drizzle/migrations/meta/_journal.json`。
2) 执行迁移：
   - 程序化（推荐）：在 Node 运行时调用 Drizzle Migrator：
     ```ts
     // 伪代码示例（可放在 scripts/migrate.ts）
     import { migrate } from 'drizzle-orm/mysql2/migrator'
     import { getDrizzle } from '@src/services/db/mysql'
     import path from 'node:path'
     
     async function main() {
       const db = await getDrizzle()
       await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle', 'migrations') })
       console.log('migrations applied')
     }
     main().catch((e) => { console.error(e); process.exit(1) })
     ```
     - 执行：`pnpm tsx scripts/migrate.ts`
   - 如你的 CI 已支持 Drizzle Kit 的“推送迁移”，也可使用：`pnpm drizzle-kit push`（需 `drizzle.config.ts` 正确配置数据库连接）。

注意事项：
- 迁移执行仅允许在 Node 运行时（声明 `export const runtime = 'nodejs'` 或使用独立脚本），不可在 Edge 运行时读取文件系统。
- 所有表结构修改统一在 `drizzle/auth.ts` 维护，通过迁移生成并执行，避免直接拼接 SQL。
- Dev 页的索引展示使用 `information_schema` 查询，仅用于验证表与索引是否存在，不参与建表逻辑。

验证：
- 执行迁移后刷新 `/dev` 页面：应能看到 `users`、`auth_session_audit`、`auth_login_attempts` 三张表，以及对应索引；“最近会话审计日志”区域可验证登录/登出行为的数据写入是否正常。