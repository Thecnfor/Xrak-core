// 会话相关类型定义（与 SessionRoot 对齐）
// 说明：cookie 仅存放会话标识与基本索引信息，敏感数据不入 cookie；
// 会话本体存储在 Redis（自建 KV），通过 sid 进行索引。

export interface SessionCookie {
  sid: string; // 会话 ID（用于在 Redis 中索引）
  userId: number; // 绑定用户 ID
  iat: number; // 签发时间（unix 秒）
  exp: number; // 过期时间（unix 秒）
}

export type Role = "admin" | "user";

export interface SessionContext {
  userId: number;
  email?: string;
  displayName?: string;
  // 快速权限判断：与 roles 并存，来自数据库 users.is_admin
  isAdmin?: boolean;
  roles?: Role[];
  // CSRF 密钥（服务端生成并通过 /api/session 下发到客户端，仅内存持有，不入 Cookie）
  csrfSecret?: string;
  // 会话签发与过期时间（秒级时间戳），便于客户端提示与服务端校验
  issuedAt?: number;
  expiresAt?: number;
  // 设备/环境指纹（当前实现为 UA 哈希，后续可扩展）
  uaHash?: string;
}

// 客户端会话类型：统一对外暴露的 SessionData（与全局约定一致）
// 说明：userId 统一在客户端以字符串形式呈现，"0" 表示匿名；保留常用基础字段。
export interface ClientSessionData {
  userId?: string; // "0" 表示匿名会话；未赋值表示无会话
  email?: string;
  displayName?: string;
  // 快速权限判断：与 roles 并存
  isAdmin?: boolean;
  roles?: Role[];
  expiresAt?: number; // 可选：过期时间戳（秒），仅用于客户端提示，不作为安全依据
  // 为方便在客户端开发页展示，附带 UA 哈希；生产环境不建议用于强认证
  uaHash?: string;
}

// 统一导出别名，便于在客户端 Provider 中直接引用 SessionData
export type SessionData = ClientSessionData;