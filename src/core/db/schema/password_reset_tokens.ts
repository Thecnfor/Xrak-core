import { mysqlTable, int, varchar, timestamp, uniqueIndex } from "drizzle-orm/mysql-core";
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  token: varchar("token", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqueToken: uniqueIndex("token_unique").on(t.token),
}));
