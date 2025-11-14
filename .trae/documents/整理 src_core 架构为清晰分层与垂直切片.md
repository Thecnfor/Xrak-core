## 现状与问题
- 客户端与服务端代码混杂在 `src/core`，心智负担大（如 `providers/*` 与 `middleware/*` 并列）。
- 职责层次不清：`db/`、`repos/`、`services/`、`middleware/`、`auth/` 横向散布，缺少明确边界与依赖方向。
- 命名与入口分散：API 入口在 `middleware/api.ts:6` 的 `withApi`，会话续期在 `api/session.ts:5`，权限/CSRF 在 `auth/guard.ts:19/30`，前端离线同步在 `sync/syncManager.ts:29/43`，应用装配在 `providers/AppProviders.tsx:6`；但这些关键路径没有统一的分层归位。
- 缺少导入约束与路径别名，跨目录相互引用易失控。

## 目标结构（分层 + 垂直切片）
- 分层：
  - `server`：仅服务端代码（中间件、鉴权、会话/数据访问、健康监控、安全策略）。
  - `client`：仅客户端代码（Provider、状态、IndexedDB、同步、埋点、API 客户端）。
  - `shared`：环境无关的类型、常量、DTO、纯函数工具。
  - `infra`：通用基础设施实现（`db/*`、`security/*`、日志、邮件/OAuth 等外部集成）。
- 垂直切片 `features/*`：按领域拆分（`auth`、`prefs`、`telemetry`、`session` 等），每个切片内再按 `server|client|shared` 布局，弱化“万能核心”。

## 目录重构映射（示例）
- 移动到 `server`：
  - `core/middleware/*`、`core/auth/*`（含 `guard.ts`）、`core/api/session.ts`、`core/session/kv.ts`、`core/services/*`、`core/repos/*`、`core/health/monitor.ts`、`core/security/*`、`core/db/*`。
- 移动到 `client`：
  - `core/providers/*`、`core/state/*`、`core/storage/indexeddb.ts`、`core/sync/*`、`core/observability/client.ts`、`core/net/apiClient.ts`。
- 移动/抽出到 `shared`：
  - 仅类型与常量（如 `../../shared/types/session` 及通用常量、DTO）。
- 归入 `features`：
  - 将 `auth/`、`prefs/`、`telemetry/` 相关模块按领域切片，分别在该切片下维护 `server|client|shared` 子目录。

## 依赖边界与约束
- 路径别名：在 `tsconfig` 定义 `@server/*`、`@client/*`、`@shared/*`、`@infra/*`、`@features/*`，禁止相对路径跨层引用。
- ESLint 约束：
  - `client` 不得引用 `server|infra`（运行时不可用）。
  - `server` 可依赖 `infra|shared`，禁止反向依赖。
  - `features/*` 仅通过 `shared` 交互，避免跨切片耦合。
- Barrel 导出：各层提供稳定入口，限制深层路径泄漏。

## 迁移步骤（4 阶段）
1. 边界治理
   - 引入路径别名与 ESLint import 规则；新增最小 `shared` 模块承载现有公共类型。
2. 目录重排（无行为改动）
   - 按映射重命名/移动文件；修正导入路径；为关键入口保留兼容导出（避免大面积改动）。
3. 垂直切片落地
   - 创建 `features/auth|prefs|telemetry`；将对应 `server|client|shared` 代码归位；为 `API` 与中间件统一入口（基于 `withApi`）。
4. 清理与统一
   - 合并重复工具；完善 Barrel；为 `services` 明确只暴露领域服务，`repos` 仅数据访问；补充 ADR 文档与示例。

## 风险控制
- 分批迁移，保留旧路径临时 re-export；每批执行后跑构建与端到端用例，确保行为不变。
- 关注浏览器/服务端边界（如 `next/headers`、`window`）避免打包泄漏。

## 验收标准
- 任何客户端模块不再引用 `next/server|headers|db|redis` 等服务端符号。
- API 入口统一（`withApi` 保持不变，位置归入 `server`）；会话/鉴权路径清晰（`server/session|auth`）。
- 垂直切片内聚：`auth|prefs|telemetry` 代码各就各位，跨切片通过 `shared` 协作。
- 导入图经 ESLint 校验通过；路径别名与 Barrel 稳定。