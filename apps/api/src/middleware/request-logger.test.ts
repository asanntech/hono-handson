import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it, vi } from "vitest";
import { app } from "../app.ts";
import { logger } from "../logger.ts";
import { errorHandler } from "./error-handler.ts";
import { requestLogger } from "./request-logger.ts";

// ユーザーを登録し、その id と、そのユーザーとしてリクエストするための Cookie ヘッダーの値を返す
const signupAs = async (email: string) => {
  const res = await app.request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const { id } = await res.json();
  const [cookie] = parseSetCookie(res);
  return { id: id as string, cookie: `token=${cookie.value}` };
};

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
    const alice = await signupAs("alice@example.com");
    const info = vi.spyOn(logger, "info");

    await app.request("/projects", {
      headers: { Cookie: alice.cookie },
    });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/projects",
        status: 200,
        userId: alice.id,
      }),
      "request completed",
    );
  });

  it("ハンドラで想定外の例外が起きても、ステータス 500 のアクセスログを出す", async () => {
    const info = vi.spyOn(logger, "info");
    const testApp = new Hono()
      .use(requestId())
      .use(requestLogger)
      .get("/", () => {
        throw new Error("connection to db-host:5432 failed");
      })
      .onError(errorHandler);

    await testApp.request("/");

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/", status: 500 }),
      "request completed",
    );
  });
});
