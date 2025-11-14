import { mysqlTable, varchar, json, timestamp } from "drizzle-orm/mysql-core";
export const prefsApp = mysqlTable("prefs_app", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: json("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
