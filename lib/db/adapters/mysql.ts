import mysql from "mysql2/promise";
import { MYSQL } from "../core/config";

type Pool = mysql.Pool;

const url = MYSQL.URL;
const host = MYSQL.HOST;
const port = MYSQL.PORT;
const user = MYSQL.USER;
const password = MYSQL.PASSWORD;
const database = MYSQL.DB;

declare global {
  var __mysqlPool: Pool | undefined;
}

function createPool(): Pool {
  if (url) return mysql.createPool(url);
  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: MYSQL.POOL_CONNECTION_LIMIT,
  });
}

export function getMySQL(): Pool {
  if (!globalThis.__mysqlPool) globalThis.__mysqlPool = createPool();
  return globalThis.__mysqlPool as Pool;
}

type SqlValue = string | number | boolean | Date | Buffer | null;
type SqlParams = readonly SqlValue[] | Readonly<Record<string, SqlValue>>;

export async function mysqlQuery<T = unknown>(
  sql: string,
  params?: SqlParams
): Promise<T[]> {
  const [rows] = await getMySQL().query<mysql.RowDataPacket[]>(sql, params);
  return rows as T[];
}
