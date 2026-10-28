import { getConnInfo } from "@hono/node-server/conninfo";
import { HTTPException } from "hono/http-exception";
import { MemoryStore, rateLimiter } from "hono-rate-limiter";

// 回数を数えるストア。テストで各テストの後に回数を消せるよう export する
export const loginRateLimitStore = new MemoryStore();

// パスワードの総当たりを防ぐため、同じ IP からのログインの試行を 15 分に 5 回までに抑える
export const loginRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  // X-Forwarded-For はクライアントが自由に書き換えられるため使わず、TCP の接続元を使う
  keyGenerator: (c) => getConnInfo(c).remote.address ?? "",
  store: loginRateLimitStore,
  // 既定ではプレーンテキストを返すため、onError の統一形式で返す
  handler: () => {
    throw new HTTPException(429);
  },
});
