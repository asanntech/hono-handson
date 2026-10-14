import { STATUS_CODES } from "node:http";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json({ error: { message: "Not Found" } }, 404);

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    // message を省略した HTTPException は空文字になるため、ステータスの標準文言で補う
    const message = err.message || STATUS_CODES[err.status] || "Error";
    return c.json({ error: { message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { message: "Internal Server Error" } }, 500);
};
