import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";

describe("GET /health", () => {
  it("200 と { status: 'ok' } を JSON で返す", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
