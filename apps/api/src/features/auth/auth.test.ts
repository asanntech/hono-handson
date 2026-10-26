import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { verify } from "hono/jwt";
import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema.ts";
import { env } from "../../env.ts";

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

  it("成功すると、ユーザー ID を sub に入れた JWT を、HttpOnly・Secure・SameSite=Strict・Path=/・Max-Age 7 日の Cookie で発行する", async () => {
    const before = Math.floor(Date.now() / 1000);
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });

    const after = Math.floor(Date.now() / 1000);
    const body = await res.json();
    const cookies = parseSetCookie(res);
    expect(cookies).toEqual([
      {
        name: "token",
        value: expect.any(String),
        maxAge: 604800,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
      },
    ]);

    const payload = await verify(cookies[0].value, env.JWT_SECRET, "HS256");
    expect(payload.sub).toBe(body.id);
    // 有効期限は Cookie の Max-Age と同じ 7 日後。秒の境目をまたいでもよいよう、リクエストの前後で挟む
    expect(payload.exp).toBeGreaterThanOrEqual(before + 604800);
    expect(payload.exp).toBeLessThanOrEqual(after + 604800);
  });
});
