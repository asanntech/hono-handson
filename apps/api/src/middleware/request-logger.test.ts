import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it, vi } from "vitest";
import { app } from "../app.ts";
import { logger } from "../logger.ts";

describe("requestLogger", () => {
  it("リクエストが終わると、リクエストID・メソッド・パス・ステータス・処理時間を 1 件のアクセスログに出す", async () => {
    const info = vi.spyOn(logger, "info");

    const res = await app.request("/health");

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      {
        requestId: res.headers.get("x-request-id"),
        method: "GET",
        path: "/health",
        status: 200,
        durationMs: expect.any(Number),
      },
      "request completed",
    );
  });

  it("ログイン済みのリクエストでは、アクセスログに userId も含める", async () => {
    const signup = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const { id } = await signup.json();
    const [cookie] = parseSetCookie(signup);
    const info = vi.spyOn(logger, "info");

    await app.request("/projects", {
      headers: { Cookie: `token=${cookie.value}` },
    });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/projects", status: 200, userId: id }),
      "request completed",
    );
  });
});
