import { mysqlTable, int, varchar, mysqlEnum, json, timestamp } from "drizzle-orm/mysql-core";
export const authSessionAudit = mysqlTable("auth_session_audit", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  event: mysqlEnum("event", ["issue", "revoke"]).notNull(),
  meta: json("meta"),
  ts: timestamp("ts").notNull().defaultNow(),
});
