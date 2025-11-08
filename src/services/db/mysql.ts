// 服务器端专用的 MySQL 服务层（基于 mysql2 + drizzle-orm）
import { readMySQLEnv } from "./env";

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("MySQL 服务仅允许在服务端/运行时使用");
  }
}

// 惰性导入以避免客户端打包
let _mysql: typeof import("mysql2/promise") | undefined;
let _drizzle: typeof import("drizzle-orm/mysql2") | undefined;

async function ensureDeps() {
  if (!_mysql) _mysql = await import("mysql2/promise");
  if (!_drizzle) _drizzle = await import("drizzle-orm/mysql2");
}

type Pool = import("mysql2/promise").Pool;
// 使用 drizzle-orm 的 MySQL2 数据库类型，提升类型安全（仅类型导入，不参与打包）
import type { MySql2Database } from "drizzle-orm/mysql2";
type Drizzle = MySql2Database;

declare global {
  // Dev/HMR 单例，避免重复连接与实例化
  var __mysql_pool__: Pool | undefined;
  var __mysql_drizzle__: Drizzle | undefined;
}

export async function getMySQLPool(): Promise<Pool> {
  assertServer();
  await ensureDeps();

  if (global.__mysql_pool__) return global.__mysql_pool__;
  const cfg = readMySQLEnv();
  const pool = _mysql!.createPool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.MYSQL_DATABASE,
    user: cfg.MYSQL_USER,
    password: cfg.MYSQL_PASSWORD,
    // Serverless 友好默认值：小连接池 + 队列等待
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 0,
  });
  global.__mysql_pool__ = pool;
  return pool;
}

export async function getDrizzle(): Promise<Drizzle> {
  assertServer();
  await ensureDeps();

  if (global.__mysql_drizzle__) return global.__mysql_drizzle__;
  const pool = await getMySQLPool();
  const db = _drizzle!.drizzle(pool);
  global.__mysql_drizzle__ = db;
  return db;
}

// 可选：简单健康检查，用于就绪探针
export async function ping(): Promise<boolean> {
  const pool = await getMySQLPool();
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
