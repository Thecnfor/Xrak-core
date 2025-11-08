// Drizzle Kit 配置（MySQL 方言）
// 说明：与 drizzle-kit@0.31+ 类型对齐，使用 dialect="mysql"，通过连接串提供凭据。
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/*.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  strict: true,
  verbose: false,
  // 通过连接串传递 MySQL 凭据，避免类型不匹配（turso 专用字段）。
  dbCredentials: {
    // DATABASE_URL 优先，其次拼接各环境变量
    url:
      process.env.DATABASE_URL ??
      `mysql://${process.env.MYSQL_USER!}:${encodeURIComponent(
        process.env.MYSQL_PASSWORD!
      )}@${process.env.MYSQL_HOST!}:${
        process.env.MYSQL_PORT || 3306
      }/${process.env.MYSQL_DATABASE!}`,
  },
});