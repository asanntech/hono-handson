import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";

describe("parseEnv", () => {
  it("PORT が指定されると数値に変換して返す", () => {
    const env = parseEnv({ PORT: "8080" });

    expect(env.PORT).toBe(8080);
  });
});
