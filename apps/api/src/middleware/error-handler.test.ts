import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { app } from "../app.ts";
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
});
