import { describe, expect, it } from "vitest";
import { app } from "../app.ts";

describe("requestId", () => {
  it("どのリクエストにも、生成したリクエストIDを X-Request-Id レスポンスヘッダーで返す", async () => {
    const first = await app.request("/health");
    const second = await app.request("/no-such-path");

    const firstId = first.headers.get("x-request-id");
    const secondId = second.headers.get("x-request-id");
    expect(firstId).toMatch(/^[\w-]+$/);
    expect(secondId).toMatch(/^[\w-]+$/);
    expect(firstId).not.toBe(secondId);
  });
});
