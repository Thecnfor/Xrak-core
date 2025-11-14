import { mysqlTable, int, varchar, json, timestamp } from "drizzle-orm/mysql-core";
export const telemetryEvents = mysqlTable("telemetry_events", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 64 }).notNull(),
  payload: json("payload"),
  ts: timestamp("ts").notNull().defaultNow(),
});
