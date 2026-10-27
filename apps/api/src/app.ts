import { Hono } from "hono";
import { auth } from "./features/auth/routes.ts";
import { health } from "./features/health/routes.ts";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.ts";

export const app = new Hono().route("/health", health).route("/auth", auth);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export type AppType = typeof app;
