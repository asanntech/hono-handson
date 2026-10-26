import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema.ts";

describe("POST /auth/signup", () => {
  it("正しいメールとパスワードなら 201 と { id, email } を返し、パスワードをハッシュ化して保存する", async () => {
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: expect.any(String),
      email: "alice@example.com",
    });

    const [saved] = await db.select().from(users).where(eq(users.id, body.id));
    expect(saved.passwordHash).not.toBe("password123");
    expect(await bcrypt.compare("password123", saved.passwordHash)).toBe(true);
  });
});
