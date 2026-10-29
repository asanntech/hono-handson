import { createMiddleware } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";
import { routePath } from "hono/route";
import { newrelic } from "./client.ts";

// requestId の後に置き、c.get("requestId") を読めるようにする
export const newrelicTransaction = createMiddleware<{
  Variables: RequestIdVariables;
}>(async (c, next) => {
  // ログと同じリクエストIDをトランザクションに付け、New Relic のトランザクションやエラーから該当のログを探せるようにする。
  // ハンドラで例外が起きても付いているよう、next() より前で付ける
  newrelic.addCustomAttributes({ requestId: c.get("requestId") });
  await next();
  // 既定では New Relic がトランザクション名を URL から付けるため、/projects/<id> のように ID ごとに別の名前になる。
  // 一致したルートのパス（/projects/:projectId）で名前を付け、同じルートへのリクエストを 1 つにまとめる。
  // 引数なしの routePath(c) はこのミドルウェア自身のパス（/*）になる。-1 で、最後に一致したハンドラのパスを取る
  newrelic.setTransactionName(`${c.req.method} ${routePath(c, -1)}`);
});
