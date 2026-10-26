import { type Context, Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { validator } from "../../middleware/validator.ts";
import { issueToken, login, signup, TOKEN_MAX_AGE } from "./service.ts";

const credentialsSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8)
    // bcrypt は 72 バイトを超える部分を無視するため、文字数ではなくバイト数で上限を設ける
    .refine((password) => Buffer.byteLength(password) <= 72),
});

// login ではパスワードの長さの規則を課さない。規則を後から変えても、既存のユーザーが login できるようにする
const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// HttpOnly で JS から読めなくし、Secure で HTTPS（と localhost）だけに送り、SameSite=Strict で他サイトからのリクエストに付けない
const setTokenCookie = async (c: Context, userId: string) => {
  setCookie(c, "token", await issueToken(userId), {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  });
};

export const auth = new Hono()
  .post("/signup", validator("json", credentialsSchema), async (c) => {
    const user = await signup(c.req.valid("json"));
    await setTokenCookie(c, user.id);
    return c.json(user, 201);
  })
  .post("/login", validator("json", loginSchema), async (c) => {
    const user = await login(c.req.valid("json"));
    await setTokenCookie(c, user.id);
    return c.json(user, 200);
  });
