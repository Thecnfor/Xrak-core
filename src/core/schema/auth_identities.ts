import { mysqlTable, int, varchar, text, mysqlEnum, timestamp, json, uniqueIndex } from "drizzle-orm/mysql-core";
export const authIdentities = mysqlTable("auth_identities", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  provider: mysqlEnum("provider", ["wechat", "google", "github", "email_link"]).notNull(),
  providerUserId: varchar("provider_user_id", { length: 128 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  profileJson: json("profile_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqueIdentity: uniqueIndex("identity_unique").on(t.provider, t.providerUserId),
}));