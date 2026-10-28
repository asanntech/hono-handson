import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
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
  // 他サイトの form から送れる形式の変更系リクエストは、Origin が同一オリジンか WEB_ORIGIN でなければ拒否する。
  // origin を指定すると既定の同一オリジンの判定が置き換わるため、両方を許可する関数で渡す
  .use(
    csrf({
      origin: (origin, c) =>
        origin === new URL(c.req.url).origin || origin === env.WEB_ORIGIN,
    }),
  )
  // 巨大なボディでメモリを使い切らせる攻撃を防ぐ。上限を超えた時点で読むのをやめ、413 を返す
  .use(bodyLimit({ maxSize: 100 * 1024 }))
  .route("/health", health)
  .route("/auth", auth)
  .route("/projects", projects);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export type AppType = typeof app;
