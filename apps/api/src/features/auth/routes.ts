import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { issueToken, login, signup, TOKEN_MAX_AGE } from "./service.ts";

const credentialsSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8)
    // bcrypt は 72 バイトを超える部分を無視するため、文字数ではなくバイト数で上限を設ける
    .refine((password) => Buffer.byteLength(password) <= 72),
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
  .post(
    "/signup",
    // 検証に失敗したら、既定の Zod のエラー形式ではなく、onError の統一形式で返す
    zValidator("json", credentialsSchema, (result) => {
      if (!result.success) {
        throw new HTTPException(400);
      }
    }),
    async (c) => {
      const user = await signup(c.req.valid("json"));
      await setTokenCookie(c, user.id);
      return c.json(user, 201);
    },
  )
  .post("/login", zValidator("json", credentialsSchema), async (c) => {
    const user = await login(c.req.valid("json"));
    await setTokenCookie(c, user.id);
    return c.json(user, 200);
  });
