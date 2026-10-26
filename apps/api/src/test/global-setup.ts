import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

// 全テストの実行前に 1 回だけ、テスト DB を空にしてから最新のスキーマにする
export default async function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL が設定されていません");
  }
  // スキーマごと削除するため、誤って開発用 DB を消さないよう DB 名で確かめる
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error(`テスト用 DB ではありません: ${new URL(url).pathname}`);
  }

  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    // 前回のテストが中断されて残ったデータや、マイグレーションを作り直す前の古いテーブルを消す
    await client`DROP SCHEMA IF EXISTS public CASCADE`;
    await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    await client`CREATE SCHEMA public`;
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(
        new URL("../db/migrations", import.meta.url),
      ),
    });
  } finally {
    await client.end();
  }
}
