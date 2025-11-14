import mysql from "mysql2/promise";
import { getEnv } from "@core/config/env";
let pool: mysql.Pool | null = null;
export async function getMysql() {
  if (pool) return pool;
  const url = getEnv().MYSQL_URL;
  pool = mysql.createPool({ uri: url, waitForConnections: true });
  return pool;
}
