import { describe, expect, it } from "vitest";
import { app } from "./app.ts";

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
