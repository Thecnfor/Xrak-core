import mysql from "mysql2/promise";

type Pool = mysql.Pool;

const url = process.env.MYSQL_URL;
const host = process.env.MYSQL_HOST;
const port = process.env.MYSQL_PORT
  ? Number(process.env.MYSQL_PORT)
  : undefined;
const user = process.env.MYSQL_USER;
const password = process.env.MYSQL_PASSWORD;
const database = process.env.MYSQL_DB;

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
    connectionLimit: 10,
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
