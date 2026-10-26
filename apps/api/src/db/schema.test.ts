import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "./client.ts";
import { users } from "./schema.ts";

describe("users テーブル", () => {
  it("ユーザーを保存すると id（UUID）と createdAt が採番されて読み出せる", async () => {
    const [created] = await db
      .insert(users)
      .values({ email: "alice@example.com" })
      .returning();

    const rows = await db.select().from(users).where(eq(users.id, created.id));

    expect(rows).toEqual([
      {
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        email: "alice@example.com",
        createdAt: expect.any(Date),
      },
    ]);
  });

  it("同じメールアドレスのユーザーを 2 人保存しようとすると一意制約違反で失敗する", async () => {
    await db.insert(users).values({ email: "alice@example.com" });

    await expect(
      db.insert(users).values({ email: "alice@example.com" }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});
