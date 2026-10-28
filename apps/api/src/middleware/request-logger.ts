import { createMiddleware } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";
import { logger } from "../logger.ts";

// リクエストごとに 1 件、結果をアクセスログに出す。requestId の後に置き、c.get("requestId") を読めるようにする
export const requestLogger = createMiddleware<{
  Variables: RequestIdVariables;
}>(async (c, next) => {
  const start = performance.now();
  await next();
  logger.info(
    {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: performance.now() - start,
    },
    "request completed",
  );
});
