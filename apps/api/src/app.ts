import { Hono } from "hono";
import { health } from "./features/health/routes.ts";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.ts";

export const app = new Hono().route("/health", health);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export type AppType = typeof app;
