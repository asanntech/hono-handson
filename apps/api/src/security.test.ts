import { describe, expect, it } from "vitest";
import { app } from "./app.ts";
import { env } from "./env.ts";

describe("セキュリティヘッダー", () => {
  // 正常なレスポンスだけでなく、notFound や onError が返すレスポンスにも付くことを確かめる
  it.each([
    ["正常なレスポンス", "/health"],
    ["404 のレスポンス", "/no-such-path"],
  ])("%s にセキュリティヘッダーを付ける", async (_, path) => {
    const res = await app.request(path);

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=15552000; includeSubDomains",
    );
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});

describe("CORS", () => {
  it("WEB_ORIGIN からのプリフライトには、そのオリジンと Cookie の送信を許可する", async () => {
    const res = await app.request("/projects", {
      method: "OPTIONS",
      headers: {
        Origin: env.WEB_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(env.WEB_ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
});
