import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/core/schema/index.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.MYSQL_URL || "",
  },
});
