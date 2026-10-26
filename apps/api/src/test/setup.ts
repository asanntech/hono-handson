import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterEach } from "vitest";
import { db } from "../db/client.ts";
import * as schema from "../db/schema.ts";

// schema.ts に定義したテーブルをすべて対象にし、テーブルを足しても空にし忘れないようにする
const tableNames = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => `"${getTableName(table)}"`)
  .join(", ");

// 各テストの後にテーブルを空にし、次のテストにデータを漏らさない。実行後にもデータを残さない
afterEach(async () => {
  await db.execute(sql.raw(`TRUNCATE ${tableNames}`));
});
