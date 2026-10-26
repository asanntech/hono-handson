import { defineConfig } from "drizzle-kit";

// drizzle-kit は .env を読まないため、ルートの .env から接続先を読み込む
process.loadEnvFile("../../.env");
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL が設定されていません");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url },
});
