import { createMiddleware } from "hono/factory";
import { routePath } from "hono/route";
import { newrelic } from "./client.ts";

// 既定では New Relic がトランザクション名を URL から付けるため、/projects/<id> のように ID ごとに別の名前になる。
// 一致したルートのパス（/projects/:projectId）で名前を付け、同じルートへのリクエストを 1 つにまとめる
export const newrelicTransaction = createMiddleware(async (c, next) => {
  await next();
  // 引数なしの routePath(c) はこのミドルウェア自身のパス（/*）になる。-1 で、最後に一致したハンドラのパスを取る
  newrelic.setTransactionName(`${c.req.method} ${routePath(c, -1)}`);
});
