import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { issueToken, signup, TOKEN_MAX_AGE } from "./service.ts";

const credentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
});

export const auth = new Hono().post(
  "/signup",
  zValidator("json", credentialsSchema),
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
