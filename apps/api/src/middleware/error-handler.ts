import { STATUS_CODES } from "node:http";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "../logger.ts";
import { newrelic } from "../newrelic/client.ts";

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json({ error: { message: "Not Found" } }, 404);

// c.get("requestId") は、hono/request-id が ContextVariableMap を拡張しているため、型引数なしで string として読める。
// 型引数で Variables を指定すると、型引数のない new Hono() の onError に渡せなくなる
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    // message を省略した HTTPException は空文字になるため、ステータスの標準文言で補う
    const message = err.message || STATUS_CODES[err.status] || "Error";
    return c.json({ error: { message } }, err.status);
  }
  // err キーに入れると、pino が message と stack を JSON に展開する。requestId でアクセスログや New Relic のエラーとつなぐ
  logger.error({ err, requestId: c.get("requestId") }, "unhandled error");
  // 4xx はクライアントの誤りで想定内のため送らない。想定外の例外だけを送り、New Relic のエラーを調査が要るものに絞る
  newrelic.noticeError(err);
  return c.json({ error: { message: "Internal Server Error" } }, 500);
};
