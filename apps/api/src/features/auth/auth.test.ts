import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { sign, verify } from "hono/jwt";
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

  it("登録済みのメールなら 409 を返し、ユーザーを増やさず Cookie も発行しない", async () => {
    const signup = () =>
      app.request("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alice@example.com",
          password: "password123",
        }),
      });
    await signup();

    const res = await signup();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { message: "Email is already registered" },
    });
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it.each([
    { case: "ちょうど 8 文字", password: "a".repeat(8) },
    { case: "ちょうど 72 バイト", password: "a".repeat(72) },
    // 「あ」は UTF-8 で 3 バイト。24 文字で 72 バイトになる
    { case: "24 文字でちょうど 72 バイト", password: "あ".repeat(24) },
  ])("パスワードが $case なら 201 を返す", async ({ password }) => {
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com", password }),
    });

    expect(res.status).toBe(201);
  });

  it.each([
    {
      case: "メールの形式が不正",
      body: { email: "not-an-email", password: "password123" },
    },
    {
      case: "パスワードが 7 文字",
      body: { email: "alice@example.com", password: "a".repeat(7) },
    },
    {
      case: "パスワードが 73 バイト",
      body: { email: "alice@example.com", password: "a".repeat(73) },
    },
    // 「あ」は UTF-8 で 3 バイト。25 文字でも 75 バイトになり、bcrypt が切り捨てる長さを超える
    {
      case: "パスワードが 25 文字だが 75 バイト",
      body: { email: "alice@example.com", password: "あ".repeat(25) },
    },
    { case: "email がない", body: { password: "password123" } },
    { case: "password がない", body: { email: "alice@example.com" } },
  ])(
    "$case なら 400 と統一形式のエラーを返し、ユーザーを作らない",
    async ({ body }) => {
      const res = await app.request("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: { message: "Bad Request" } });
      expect(await db.select().from(users)).toEqual([]);
    },
  );
});

describe("POST /auth/login", () => {
  it("登録済みのメールと正しいパスワードなら 200 と { id, email } を返し、signup と同じ属性の Cookie で JWT を発行する", async () => {
    const signupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const { id } = await signupRes.json();

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id, email: "alice@example.com" });
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
    expect(payload.sub).toBe(id);
  });

  // 未登録とパスワード違いを同じ応答にし、メールが登録済みかどうかを漏らさない
  it.each([
    {
      case: "未登録のメール",
      body: { email: "bob@example.com", password: "password123" },
    },
    {
      case: "パスワード違い",
      body: { email: "alice@example.com", password: "wrong-password" },
    },
  ])(
    "$case なら 401 と共通の message を返し、Cookie を発行しない",
    async ({ body }) => {
      await app.request("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alice@example.com",
          password: "password123",
        }),
      });

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        error: { message: "Invalid email or password" },
      });
      expect(res.headers.getSetCookie()).toEqual([]);
    },
  );

  it.each([
    {
      case: "メールの形式が不正",
      body: { email: "not-an-email", password: "password123" },
    },
    {
      case: "パスワードが空",
      body: { email: "alice@example.com", password: "" },
    },
    { case: "email がない", body: { password: "password123" } },
    { case: "password がない", body: { email: "alice@example.com" } },
  ])("$case なら 400 と統一形式のエラーを返す", async ({ body }) => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { message: "Bad Request" } });
  });

  // パスワードの長さの規則は signup で課すもの。規則を後から厳しくしても、既存のユーザーが login できなくならないようにする
  it("signup の規則に合わない長さのパスワードでも、400 ではなく 401 を返す", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com", password: "short" }),
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("有効な Cookie を付けると 200 とログイン中のユーザー { id, email } を返す", async () => {
    const signupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const { id } = await signupRes.json();
    const [cookie] = parseSetCookie(signupRes);

    const res = await app.request("/auth/me", {
      headers: { Cookie: `token=${cookie.value}` },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id, email: "alice@example.com" });
  });

  it("JWT は有効でもユーザーが存在しなければ 401 を返す", async () => {
    const signupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const { id } = await signupRes.json();
    const [cookie] = parseSetCookie(signupRes);
    // JWT は期限まで有効なままなので、発行後にユーザーが削除されることがある
    await db.delete(users).where(eq(users.id, id));

    const res = await app.request("/auth/me", {
      headers: { Cookie: `token=${cookie.value}` },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { message: "Unauthorized" } });
  });

  it("Cookie を付けないと 401 と統一形式のエラーを返す", async () => {
    const res = await app.request("/auth/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { message: "Unauthorized" } });
  });

  it.each([
    {
      case: "ペイロードを書き換えた JWT",
      // 本人の JWT の署名を流用し、ペイロードだけを別のユーザー ID のものに差し替える
      token: async (userId: string) => {
        const exp = Math.floor(Date.now() / 1000) + 60;
        const [header, , signature] = (
          await sign({ sub: userId, exp }, env.JWT_SECRET, "HS256")
        ).split(".");
        const [, payload] = (
          await sign(
            { sub: "00000000-0000-0000-0000-000000000000", exp },
            env.JWT_SECRET,
            "HS256",
          )
        ).split(".");
        return `${header}.${payload}.${signature}`;
      },
    },
    {
      case: "別の秘密鍵で署名した JWT",
      token: (userId: string) =>
        sign(
          { sub: userId, exp: Math.floor(Date.now() / 1000) + 60 },
          "another-secret-that-is-32-chars-long!!",
          "HS256",
        ),
    },
    {
      case: "有効期限が切れた JWT",
      token: (userId: string) =>
        sign(
          { sub: userId, exp: Math.floor(Date.now() / 1000) - 1 },
          env.JWT_SECRET,
          "HS256",
        ),
    },
    { case: "JWT の形式でない文字列", token: async () => "not-a-jwt" },
    {
      case: "sub がない JWT",
      token: () =>
        sign(
          { exp: Math.floor(Date.now() / 1000) + 60 },
          env.JWT_SECRET,
          "HS256",
        ),
    },
  ])("$case の Cookie なら 401 を返す", async ({ token }) => {
    const signupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const { id } = await signupRes.json();

    const res = await app.request("/auth/me", {
      headers: { Cookie: `token=${await token(id)}` },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { message: "Unauthorized" } });
  });
});
