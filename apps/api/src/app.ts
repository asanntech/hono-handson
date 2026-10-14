import { Hono } from "hono";
import { health } from "./features/health/routes.ts";
import { notFoundHandler } from "./middleware/error-handler.ts";

export const app = new Hono().route("/health", health);

app.notFound(notFoundHandler);

export type AppType = typeof app;
