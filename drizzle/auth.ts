// 用户与认证相关数据库结构（Drizzle Schema）
// 说明：会话本体存储在 Redis（自建 KV）；MySQL 仅记录审计与登录行为、设备信息等结构化数据。

import { mysqlTable, int, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

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
    ip: varchar("ip", { length: 64 }).default(""),
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
    success: int("success").default(0), // 0=失败, 1=成功
    reason: varchar("reason", { length: 128 }).default(""), // 失败原因或备注
    ip: varchar("ip", { length: 64 }).default(""),
    uaHash: varchar("ua_hash", { length: 128 }).default(""),
    createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => {
    return {
      emailIdx: index("idx_login_email").on(table.email),
      userIdx: index("idx_login_user").on(table.userId),
      createdIdx: index("idx_login_created_at").on(table.createdAt),
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
    };
  }
);

// 统一导出 schema 对象，供 drizzle 客户端进行类型绑定
export const auth = {
  users,
  authSessionAudit,
  authLoginAttempts,
  authUserDevices,
};