import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verify } from "hono/jwt";
import { env } from "../env.ts";

// JWT を入れる Cookie の名前。発行する側（auth の routes）と読む側（このミドルウェア）で共有する
export const TOKEN_COOKIE_NAME = "token";

// 後続のハンドラが c.get("userId") で受け取る値の型
export type AuthVariables = { userId: string };

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const token = getCookie(c, TOKEN_COOKIE_NAME);
    if (!token) {
      throw new HTTPException(401);
    }
    // 署名の不一致・形式の誤り・期限切れでは verify が例外を投げる。どれも 401 にそろえる
    const payload = await verify(token, env.JWT_SECRET, "HS256").catch(() => {
      throw new HTTPException(401);
    });
    if (typeof payload.sub !== "string") {
      throw new HTTPException(401);
    }
    c.set("userId", payload.sub);
    await next();
  },
);
