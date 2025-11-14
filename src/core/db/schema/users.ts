import { mysqlTable, int, varchar, boolean, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 128 }),
  isAdmin: boolean("is_admin").notNull().default(false),
  status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
