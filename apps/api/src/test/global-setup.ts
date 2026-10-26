import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

// 全テストの実行前に 1 回だけ、テスト DB を最新のスキーマにする
export default async function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL が設定されていません");
  }
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: new URL("../db/migrations", import.meta.url).pathname,
    });
  } finally {
    await client.end();
  }
}
