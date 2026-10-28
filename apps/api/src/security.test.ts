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

  // 許可するオリジンを * やリクエストの Origin の反射に緩めると、どのサイトの JS からも Cookie 付きでレスポンスを読めてしまう
  it("WEB_ORIGIN 以外のオリジンには Access-Control-Allow-Origin を返さない", async () => {
    const res = await app.request("/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("CSRF", () => {
  // 他サイトの <form> から送れる形式。JSON と違ってプリフライトが起きず、ブラウザは Cookie 付きでそのまま送ってしまう
  it.each([
    "application/x-www-form-urlencoded",
    "multipart/form-data; boundary=x",
    "text/plain",
  ])(
    "別オリジンから %s の POST が来たら 403 を返し、処理しない",
    async (contentType) => {
      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          Origin: "https://evil.example",
          Cookie: "token=dummy",
        },
        body: "",
      });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: { message: "Forbidden" } });
      // logout が処理されていれば、Cookie を消す Set-Cookie が返る
      expect(res.headers.get("Set-Cookie")).toBeNull();
    },
  );

  // WEB_ORIGIN は CORS で許可した SPA のオリジン。同一オリジンでなくても、自分たちのフロントエンドからの送信は通す
  it.each([
    ["同一オリジン", "http://localhost"],
    ["WEB_ORIGIN", env.WEB_ORIGIN],
  ])(
    "%s から form 形式の POST が来たら通常どおり処理する",
    async (_, origin) => {
      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: origin,
        },
        body: "",
      });

      expect(res.status).toBe(204);
    },
  );
});

describe("リクエストボディの上限", () => {
  it("ボディがちょうど 100KB なら上限に掛けず、後続の処理に渡す", async () => {
    const res = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "a".repeat(100 * 1024),
      },
      { incoming: { socket: { remoteAddress: "192.0.2.1" } } },
    );

    // 本文を最後まで読んだうえで JSON として不正なので、バリデーターが 400 を返す
    expect(res.status).toBe(400);
  });

  it("ボディが 100KB を超えると 413 を返す", async () => {
    const res = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "a".repeat(100 * 1024 + 1),
      },
      { incoming: { socket: { remoteAddress: "192.0.2.1" } } },
    );

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: { message: "Payload Too Large" },
    });
  });
});
