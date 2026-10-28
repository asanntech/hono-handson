import { createMiddleware } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";
import { logger } from "../logger.ts";
import type { AuthVariables } from "./auth.ts";

// リクエストごとに 1 件、結果をアクセスログに出す。requestId の後に置き、c.get("requestId") を読めるようにする。
// userId は後続の requireAuth が c.set するため、next() の後に読む。ログインが要らないルートでは undefined になる
export const requestLogger = createMiddleware<{
  Variables: RequestIdVariables & Partial<AuthVariables>;
}>(async (c, next) => {
  const start = performance.now();
  await next();
  logger.info(
    {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      userId: c.get("userId"),
      durationMs: performance.now() - start,
    },
    "request completed",
  );
});
