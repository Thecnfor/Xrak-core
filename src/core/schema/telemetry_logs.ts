import { mysqlTable, int, varchar, json, timestamp } from "drizzle-orm/mysql-core";
export const telemetryLogs = mysqlTable("telemetry_logs", {
  id: int("id").primaryKey().autoincrement(),
  level: varchar("level", { length: 16 }).notNull(),
  msg: varchar("msg", { length: 255 }).notNull(),
  meta: json("meta"),
  ts: timestamp("ts").notNull().defaultNow(),
});