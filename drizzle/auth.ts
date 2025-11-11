// 用户与认证相关数据库结构（Drizzle Schema）
// 说明：会话本体存储在 Redis（自建 KV）；MySQL 仅记录审计与登录行为、设备信息等结构化数据。

// 数据库表结构（Drizzle Schema）：针对认证与审计的结构化数据
// 最佳实践：
// - 保持列命名统一使用 snake_case（便于与信息_SCHEMA/日志对齐）
// - IP 字段使用 45 长度，兼容 IPv4/IPv6
// - 对高频查询字段补充索引（user_id、issued_at/created_at 等）
// - 布尔值使用 boolean()，底层映射为 TINYINT(1)
// - 设备唯一性通过 (user_id, ua_hash) 复合唯一索引
import { mysqlTable, int, varchar, timestamp, index, uniqueIndex, boolean } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

// 用户表：存储基础资料与本地密码哈希
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    // 额外存储盐值（合规/审计可选项，argon2 哈希内已包含随机盐）
    passwordSalt: varchar("password_salt", { length: 128 }).default(""),
    displayName: varchar("display_name", { length: 64 }).default(""),
    // 角色与账号等级：为后续 VIP/等级功能预留
    isAdmin: boolean("is_admin").default(false), // 管理员标记：0=普通用户, 1=管理员
    userLevel: int("user_level").default(0), // 用户等级：0 表示默认等级
    vipLevel: int("vip_level").default(0), // VIP 等级：0 表示无 VIP
    emailVerifiedAt: timestamp("email_verified_at", { mode: "date" }).default(sql`NULL`),
    // 最近登录时间（便于运维与风控）
    lastLoginAt: timestamp("last_login_at", { mode: "date" }).default(sql`NULL`),
    createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
  },
  (table) => {
    return {
      emailIdx: index("idx_users_email").on(table.email),
      emailUnique: uniqueIndex("uniq_users_email").on(table.email),
      lastLoginIdx: index("idx_users_last_login").on(table.lastLoginAt),
      adminIdx: index("idx_users_is_admin").on(table.isAdmin),
      userLevelIdx: index("idx_users_user_level").on(table.userLevel),
      vipLevelIdx: index("idx_users_vip_level").on(table.vipLevel),
    };
  }
);

// 会话审计：记录 cookie+session 的发放与撤销（不存储会话本体）
export const authSessionAudit = mysqlTable(
  "auth_session_audit",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: varchar("session_id", { length: 128 }).notNull(),
    userId: int("user_id").notNull(),
    // 便于问题排查与设备分析
    ip: varchar("ip", { length: 45 }).default(""),
    uaHash: varchar("ua_hash", { length: 128 }).default(""),
    userAgent: varchar("user_agent", { length: 512 }).default(""),
    country: varchar("country", { length: 2 }).default(""),
    city: varchar("city", { length: 64 }).default(""),
    issuedAt: timestamp("issued_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
    revokedAt: timestamp("revoked_at", { mode: "date" }).default(sql`NULL`),
  },
  (table) => {
    return {
      sessionIdx: index("idx_auth_session_id").on(table.sessionId),
      userIdx: index("idx_auth_session_user").on(table.userId),
      ipIdx: index("idx_auth_session_ip").on(table.ip),
      // 新增索引：按时间快速检索与分页
      issuedIdx: index("idx_auth_session_issued_at").on(table.issuedAt),
      revokedIdx: index("idx_auth_session_revoked_at").on(table.revokedAt),
      userIssuedIdx: index("idx_auth_session_user_issued").on(table.userId, table.issuedAt),
    };
  }
);

// 登录尝试记录：成功/失败均写入，便于风控与审计
export const authLoginAttempts = mysqlTable(
  "auth_login_attempts",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    userId: int("user_id").default(0), // 未匹配到用户则为 0
    success: boolean("success").default(false), // 0=失败, 1=成功（TINYINT(1)）
    reason: varchar("reason", { length: 128 }).default(""), // 失败原因或备注
    ip: varchar("ip", { length: 45 }).default(""),
    uaHash: varchar("ua_hash", { length: 128 }).default(""),
    createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => {
    return {
      emailIdx: index("idx_login_email").on(table.email),
      userIdx: index("idx_login_user").on(table.userId),
      createdIdx: index("idx_login_created_at").on(table.createdAt),
      ipIdx: index("idx_login_ip").on(table.ip),
      // 近窗口统计常用复合索引：按邮箱/IP + 时间快速筛选
      emailTimeIdx: index("idx_login_email_time").on(table.email, table.createdAt),
      ipTimeIdx: index("idx_login_ip_time").on(table.ip, table.createdAt),
    };
  }
);

// 冷热分层（可选）：审计归档表（结构与主表相近，索引较为精简）
// 说明：建议配合定时任务将超历史数据迁移至此表或归档库；应用查询默认命中主表，归档仅用于审计取证
export const authSessionAuditArchive = mysqlTable(
  "auth_session_audit_archive",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: varchar("session_id", { length: 128 }).notNull(),
    userId: int("user_id").notNull(),
    ip: varchar("ip", { length: 45 }).default(""),
    uaHash: varchar("ua_hash", { length: 128 }).default(""),
    userAgent: varchar("user_agent", { length: 512 }).default(""),
    country: varchar("country", { length: 2 }).default(""),
    city: varchar("city", { length: 64 }).default(""),
    issuedAt: timestamp("issued_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
    revokedAt: timestamp("revoked_at", { mode: "date" }).default(sql`NULL`),
  },
  (table) => {
    return {
      userIssuedIdx: index("idx_audit_archive_user_issued").on(table.userId, table.issuedAt),
      ipIdx: index("idx_audit_archive_ip").on(table.ip),
    };
  }
);

// 邮件验证令牌（注册邮箱验证等）
// 最佳实践：仅存储令牌哈希（token_hash），原始令牌仅通过邮件下发且不入库，提升安全性
export const verificationTokens = mysqlTable(
  "verification_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").default(0), // 未绑定用户的场景下为 0
    email: varchar("email", { length: 254 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(), // 原始令牌通过 SHA256 等方式哈希后存储
    // 令牌有效期，过期后不可使用
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
    consumedAt: timestamp("consumed_at", { mode: "date" }).default(sql`NULL`),
    consumed: boolean("consumed").default(false),
    revokedAt: timestamp("revoked_at", { mode: "date" }).default(sql`NULL`),
  },
  (table) => {
    return {
      emailIdx: index("idx_verify_email").on(table.email),
      userIdx: index("idx_verify_user").on(table.userId),
      expireIdx: index("idx_verify_expires_at").on(table.expiresAt),
      tokenUnique: uniqueIndex("uniq_verify_token_hash").on(table.tokenHash),
    };
  }
);

// 密码重置令牌
// 最佳实践：仅存储令牌哈希（token_hash），并记录使用状态与撤销
export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
    consumedAt: timestamp("consumed_at", { mode: "date" }).default(sql`NULL`),
    consumed: boolean("consumed").default(false),
    revokedAt: timestamp("revoked_at", { mode: "date" }).default(sql`NULL`),
  },
  (table) => {
    return {
      userIdx: index("idx_reset_user").on(table.userId),
      emailIdx: index("idx_reset_email").on(table.email),
      expireIdx: index("idx_reset_expires_at").on(table.expiresAt),
      tokenUnique: uniqueIndex("uniq_reset_token_hash").on(table.tokenHash),
    };
  }
);

// 用户设备信息：跟踪已知设备与最近活动（配合 Redis 中的会话索引）
export const authUserDevices = mysqlTable(
  "auth_user_devices",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    uaHash: varchar("ua_hash", { length: 128 }).notNull(), // 设备指纹（当前为 UA 哈希）
    label: varchar("label", { length: 64 }).default(""), // 可选的设备名称标签
    firstSeenAt: timestamp("first_seen_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
    revokedAt: timestamp("revoked_at", { mode: "date" }).default(sql`NULL`),
  },
  (table) => {
    return {
      userIdx: index("idx_devices_user").on(table.userId),
      uaIdx: index("idx_devices_ua").on(table.uaHash),
      userUaUnique: uniqueIndex("uniq_user_ua").on(table.userId, table.uaHash),
      // 新增索引：便于查询最近在线与已撤销状态
      lastSeenIdx: index("idx_devices_last_seen_at").on(table.lastSeenAt),
      revokedIdx: index("idx_devices_revoked_at").on(table.revokedAt),
    };
  }
);

// 用户偏好设置：可扩展的 KV 结构，支持按命名空间组织（例如 ui/theme）
// 设计要点：
// - 使用 (user_id, namespace, key) 作为唯一约束，便于 upsert
// - 值使用 JSON 文本存储（TEXT），应用层负责序列化/反序列化与类型检查
// - 高频读取场景建议在 Redis 做旁路缓存（例如 user:prefs:<userId>:<namespace>）
export const userPreferences = mysqlTable(
  "user_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    namespace: varchar("namespace", { length: 64 }).notNull().default("default"),
    key: varchar("key", { length: 64 }).notNull(),
    valueJson: varchar("value_json", { length: 2048 }).notNull().default("{}"),
    updatedAt: timestamp("updated_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
    createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => {
    return {
      userIdx: index("idx_prefs_user").on(table.userId),
      nsIdx: index("idx_prefs_namespace").on(table.namespace),
      uniqueKey: uniqueIndex("uniq_user_pref").on(table.userId, table.namespace, table.key),
      updatedIdx: index("idx_prefs_updated_at").on(table.updatedAt),
    };
  }
);

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

// 管理操作审计：记录管理员对用户的角色/等级等变更行为
// 说明：与会话审计分离，专用于管理端操作留痕
export const adminAuditLogs = mysqlTable(
  "admin_audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    adminUserId: int("admin_user_id").notNull(),
    targetUserId: int("target_user_id").notNull(),
    action: varchar("action", { length: 64 }).notNull(), // e.g. "update_roles", "update_levels"
    detailJson: varchar("detail_json", { length: 1024 }).notNull().default("{}"),
    createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => {
    return {
      adminIdx: index("idx_admin_audit_admin").on(table.adminUserId),
      targetIdx: index("idx_admin_audit_target").on(table.targetUserId),
      createdIdx: index("idx_admin_audit_created_at").on(table.createdAt),
      adminTargetIdx: index("idx_admin_audit_admin_target").on(table.adminUserId, table.targetUserId),
    };
  }
);


// 统一导出 schema 对象，供 drizzle 客户端进行类型绑定
export const auth = {
  users,
  authSessionAudit,
  authLoginAttempts,
  authUserDevices,
  userPreferences,
  adminAuditLogs,
};