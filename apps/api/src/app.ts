import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.ts";
import { auth } from "./features/auth/routes.ts";
import { health } from "./features/health/routes.ts";
import { projects } from "./features/projects/routes.ts";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.ts";

export const app = new Hono()
  // 全レスポンスに、MIME スニッフィングや iframe への埋め込みを禁じるヘッダーを付ける
  .use(secureHeaders())
  // プリフライトは Cookie を付けずに来るため、認証より前で応答する。Cookie を送れるよう credentials を許可する
  .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
  .route("/health", health)
  .route("/auth", auth)
  .route("/projects", projects);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export type AppType = typeof app;
