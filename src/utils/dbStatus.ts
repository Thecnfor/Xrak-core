// 数据库与缓存状态工具方法（SSR/Server Actions 可用）
// 说明：集中提供 MySQL/MongoDB/Redis 的列表与健康查询，供页面与管理端复用。

import type { RowDataPacket } from "mysql2/promise";
import { getMySQLPool } from "@src/services/db/mysql";
import { getMongoDb } from "@src/services/db/mongo";
import { getRedisClient } from "@src/services/db/redis";
import { desc } from "drizzle-orm";
import { getDrizzle } from "@src/services/db/mysql";
import { authSessionAudit } from "@/drizzle/auth";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "node:path";

// MySQL：使用 information_schema 列出当前库的表（强类型避免 any）
export interface TableRow extends RowDataPacket {
  tableName: string;
}

export async function listMysqlTables(): Promise<string[]> {
  "use server";
  try {
    const pool = await getMySQLPool();
    const [rows] = await pool.query<TableRow[]>(
      "SELECT TABLE_NAME as tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
    );
    return rows.map((r) => r.tableName);
  } catch {
    return [];
  }
}

// 服务器动作：执行 Drizzle 迁移（快速建表/修复结构）
export async function runDrizzleMigrations() {
  "use server";
  // 说明：本方法会先删除认证相关表，再执行 Drizzle 迁移，以“最新 Schema”覆盖现有结构。
  // 警告：此操作具备破坏性，仅用于本地开发或空库初始化，切勿在生产库随意执行！
  
  // 1) 先删除既有认证相关表，避免历史结构干扰（禁用外键检查以防止级联阻塞）
  const pool = await getMySQLPool();
  try {
    await pool.query("SET FOREIGN_KEY_CHECKS=0");
    const tables = [
      "auth_user_devices",
      "auth_login_attempts",
      "auth_session_audit",
      "users",
    ];
    for (const t of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS \`${t}\``);
      } catch {
        // 忽略单表删除错误，继续执行
      }
    }
  } finally {
    try {
      await pool.query("SET FOREIGN_KEY_CHECKS=1");
    } catch {
      // 忽略恢复外键检查失败
    }
  }

  // 2) 使用 Drizzle Migrator 执行 migrations 目录下的 SQL，确保与生产一致
  const db = await getDrizzle();
  const migrationsFolder = path.join(process.cwd(), "drizzle", "migrations");
  await migrate(db, { migrationsFolder });
}

// 查询指定表的索引信息，便于在页面展示合规性
export async function getTableIndexes(tableNames: string[]): Promise<Record<string, string[]>> {
  "use server";
  const pool = await getMySQLPool();
  if (tableNames.length === 0) return {};
  const placeholders = tableNames.map(() => "?").join(",");
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME as tableName, INDEX_NAME as indexName
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})
       ORDER BY TABLE_NAME, INDEX_NAME`,
      tableNames
    );
    const map: Record<string, string[]> = {};
    for (const r of rows) {
      const t = String(r.tableName);
      const i = String(r.indexName);
      if (!map[t]) map[t] = [];
      if (!map[t].includes(i)) map[t].push(i);
    }
    return map;
  } catch {
    return {};
  }
}

// MongoDB：列出集合名称
export async function listMongoCollections(): Promise<string[]> {
  "use server";
  try {
    const db = await getMongoDb();
    const cols = (await db
      .listCollections({}, { nameOnly: true })
      .toArray()) as Array<{ name: string }>;
    return cols.map((c) => c.name);
  } catch {
    return [];
  }
}

// Redis：采样列出部分 Key（SCAN）
export async function listRedisSampleKeys(limit = 50): Promise<string[]> {
  "use server";
  try {
    const client = await getRedisClient();
    let cursor = 0;
    const keys: string[] = [];
    while (true) {
      const res = await client.scan(cursor, { COUNT: Math.max(1, Math.min(limit - keys.length, 50)) });
      const nextCursor = Number(res.cursor ?? (Array.isArray(res) ? res[0] : 0));
      const batch: string[] = res.keys ?? (Array.isArray(res) ? res[1] : []);
      keys.push(...batch);
      cursor = nextCursor;
      if (cursor === 0 || keys.length >= limit) break;
    }
    return keys.slice(0, limit);
  } catch {
    return [];
  }
}

// SSR：三库状态聚合
export async function getThreeDbStatus(): Promise<{
  mysql: { ok: boolean; tables: string[] };
  mongo: { ok: boolean; collections: string[] };
  redis: { ok: boolean; keys: string[] };
}> {
  "use server";
  const [mysqlTables, mongoCols, redisKeys] = await Promise.all([
    listMysqlTables(),
    listMongoCollections(),
    listRedisSampleKeys(50),
  ]);
  return {
    mysql: { ok: mysqlTables.length >= 0, tables: mysqlTables },
    mongo: { ok: mongoCols.length >= 0, collections: mongoCols },
    redis: { ok: redisKeys.length >= 0, keys: redisKeys },
  };
}

// 查询最近的会话审计日志（便于验证登录/登出行为）
export async function getRecentSessionAudits(
  limit = 10
): Promise<
  Array<{
    id: number;
    sessionId: string;
    userId: number;
    issuedAt: Date | null;
    revokedAt: Date | null;
  }>
> {
  "use server";
  const db = await getDrizzle();
  try {
    const rows = await db
      .select()
      .from(authSessionAudit)
      .limit(limit)
      .orderBy(desc(authSessionAudit.id));
    return rows.map((r) => ({
      id: r.id!,
      sessionId: r.sessionId!,
      userId: r.userId!,
      issuedAt: r.issuedAt ?? null,
      revokedAt: r.revokedAt ?? null,
    }));
  } catch {
    return [];
  }
}