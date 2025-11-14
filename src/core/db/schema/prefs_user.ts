import { mysqlTable, int, varchar, json, timestamp, uniqueIndex } from "drizzle-orm/mysql-core";
export const prefsUser = mysqlTable("prefs_user", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  key: varchar("key", { length: 64 }).notNull(),
  value: json("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  uniqueUserKey: uniqueIndex("unique_user_key").on(t.userId, t.key),
}));
