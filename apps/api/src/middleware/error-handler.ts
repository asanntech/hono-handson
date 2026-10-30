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
  // HTTPException は投げる側が意図して返すエラーのため、エラーログにも New Relic にも送らない。
  // 今は 4xx しか投げていない。5xx を投げるようになったら、ここで送るようにする
  if (err instanceof HTTPException) {
    // message を省略した HTTPException は空文字になるため、ステータスの標準文言で補う
    const message = err.message || STATUS_CODES[err.status] || "Error";
    return c.json({ error: { message } }, err.status);
  }
  // ここに来るのは想定外の例外だけ。ログと New Relic のエラーを、調査が要るものに絞る。
  // err キーに入れると、pino が message と stack を JSON に展開する。requestId でアクセスログや New Relic のエラーとつなぐ
  logger.error({ err, requestId: c.get("requestId") }, "unhandled error");
  newrelic.noticeError(err);
  return c.json({ error: { message: "Internal Server Error" } }, 500);
};
