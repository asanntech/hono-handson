import { describe, expect, it } from "vitest";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";

// 同じファイル内のテストは上から順に実行される。1 本目で保存したデータが 2 本目に漏れないことを確かめる
describe("テストごとの DB 初期化", () => {
  it("1 本目のテストでユーザーを保存する", async () => {
    await db.insert(users).values({ email: "alice@example.com" });

    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("2 本目のテストからは、前のテストで保存したユーザーが見えない", async () => {
    expect(await db.select().from(users)).toEqual([]);
  });
});
