import { mysqlTable, int, varchar, text, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";
export const emailOutbox = mysqlTable("email_outbox", {
  id: int("id").primaryKey().autoincrement(),
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).notNull().default("pending"),
  attempts: int("attempts").notNull().default(0),
  lastError: varchar("last_error", { length: 255 }),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
