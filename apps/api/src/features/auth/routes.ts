import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { issueToken, signup, TOKEN_MAX_AGE } from "./service.ts";

const credentialsSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8)
    // bcrypt は 72 バイトを超える部分を無視するため、文字数ではなくバイト数で上限を設ける
    .refine((password) => Buffer.byteLength(password) <= 72),
});

export const auth = new Hono().post(
  "/signup",
  // 検証に失敗したら、既定の Zod のエラー形式ではなく、onError の統一形式で返す
  zValidator("json", credentialsSchema, (result) => {
    if (!result.success) {
      throw new HTTPException(400);
    }
  }),
  async (c) => {
    const user = await signup(c.req.valid("json"));
    // HttpOnly で JS から読めなくし、Secure で HTTPS（と localhost）だけに送り、SameSite=Strict で他サイトからのリクエストに付けない
    setCookie(c, "token", await issueToken(user.id), {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      maxAge: TOKEN_MAX_AGE,
    });
    return c.json(user, 201);
  },
);
