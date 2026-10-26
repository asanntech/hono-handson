import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { beforeEach } from "vitest";
import { db } from "../db/client.ts";
import * as schema from "../db/schema.ts";

// schema.ts に定義したテーブルをすべて対象にし、テーブルを足しても空にし忘れないようにする
const tableNames = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => `"${getTableName(table)}"`)
  .join(", ");

// 各テストの前にテーブルを空にし、前のテストのデータが漏れないようにする
beforeEach(async () => {
  await db.execute(sql.raw(`TRUNCATE ${tableNames}`));
});
