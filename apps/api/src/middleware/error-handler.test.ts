import { describe, expect, it } from "vitest";
import { app } from "../app.ts";

describe("notFoundHandler", () => {
  it("存在しないパスには 404 と NOT_FOUND を返す", async () => {
    const res = await app.request("/no-such-path");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Not Found" },
    });
  });
});
