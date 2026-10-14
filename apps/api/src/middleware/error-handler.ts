import type { NotFoundHandler } from "hono";

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json({ error: { code: "NOT_FOUND", message: "Not Found" } }, 404);
