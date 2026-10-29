import { STATUS_CODES } from "node:http";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { newrelic } from "../newrelic/client.ts";

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json({ error: { message: "Not Found" } }, 404);

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    // message を省略した HTTPException は空文字になるため、ステータスの標準文言で補う
    const message = err.message || STATUS_CODES[err.status] || "Error";
    return c.json({ error: { message } }, err.status);
  }
  console.error(err);
  // 4xx はクライアントの誤りで想定内のため送らない。想定外の例外だけを送り、New Relic のエラーを調査が要るものに絞る
  newrelic.noticeError(err);
  return c.json({ error: { message: "Internal Server Error" } }, 500);
};
