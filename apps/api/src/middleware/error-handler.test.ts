import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";
import { app } from "../app.ts";
import { newrelic } from "../newrelic/client.ts";
import { errorHandler } from "./error-handler.ts";

describe("notFoundHandler", () => {
  it("存在しないパスには 404 と統一形式のエラーを返す", async () => {
    const res = await app.request("/no-such-path");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { message: "Not Found" } });
  });
});

describe("errorHandler", () => {
  it.each([
    { status: 403, message: "オーナーのみ操作できます" },
    { status: 409, message: "既に登録されています" },
  ] as const)(
    "HTTPException($status) を投げると $status と指定した message を返す",
    async ({ status, message }) => {
      const testApp = new Hono()
        .get("/", () => {
          throw new HTTPException(status, { message });
        })
        .onError(errorHandler);

      const res = await testApp.request("/");

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: { message } });
    },
  );

  it.each([
    { status: 401, message: "Unauthorized" },
    { status: 404, message: "Not Found" },
  ] as const)(
    "message を指定しない HTTPException($status) には標準の文言 $message を返す",
    async ({ status, message }) => {
      const testApp = new Hono()
        .get("/", () => {
          throw new HTTPException(status);
        })
        .onError(errorHandler);

      const res = await testApp.request("/");

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: { message } });
    },
  );

  it("想定外の例外には 500 と汎用の message を返し、例外の内容を含めない", async () => {
    const testApp = new Hono()
      .get("/", () => {
        throw new Error("connection to db-host:5432 failed");
      })
      .onError(errorHandler);

    const res = await testApp.request("/");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { message: "Internal Server Error" },
    });
  });

  it("想定外の例外はサーバーのログに出す", async () => {
    const consoleError = vi.spyOn(console, "error");
    const error = new Error("connection to db-host:5432 failed");
    const testApp = new Hono()
      .get("/", () => {
        throw error;
      })
      .onError(errorHandler);

    await testApp.request("/");

    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it("想定外の例外は noticeError で New Relic に送る", async () => {
    const noticeError = vi.spyOn(newrelic, "noticeError");
    const error = new Error("connection to db-host:5432 failed");
    const testApp = new Hono()
      .get("/", () => {
        throw error;
      })
      .onError(errorHandler);

    await testApp.request("/");

    expect(noticeError).toHaveBeenCalledWith(error);
  });
});
