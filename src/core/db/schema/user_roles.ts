import { mysqlTable, int, varchar, primaryKey } from "drizzle-orm/mysql-core";
export const userRoles = mysqlTable("user_roles", {
  userId: int("user_id").notNull(),
  role: varchar("role", { length: 32 }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.role] }),
}));
