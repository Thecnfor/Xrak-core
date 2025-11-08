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
  - `import { AppProviders, SessionRoot } from "@/src/lib/providers"`
  - `import { cn } from "@src/utils/cn"`

### Provider 统一入口使用示例

- 引入统一入口：`import { AppProviders, SessionRoot } from "@/src/lib/providers"`。
- 页面结构遵循全局栈：在 `app/layout.tsx` 仅使用统一入口导出，避免跨文件散乱导入。