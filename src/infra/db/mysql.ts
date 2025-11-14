import mysql from "mysql2/promise";
let pool: mysql.Pool | null = null;
export async function getMysql() {
  if (pool) return pool;
  const url = process.env.MYSQL_URL as string;
  pool = mysql.createPool({ uri: url, waitForConnections: true });
  return pool;
}
