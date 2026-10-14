import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";

describe("parseEnv", () => {
  it("PORT が指定されると数値に変換して返す", () => {
    const env = parseEnv({ PORT: "8080" });

    expect(env.PORT).toBe(8080);
  });

  it("NODE_ENV が指定されるとその値を返す", () => {
    const env = parseEnv({ NODE_ENV: "production" });

    expect(env.NODE_ENV).toBe("production");
  });

  it("PORT と NODE_ENV が未指定なら 3000 と development を既定値にする", () => {
    const env = parseEnv({});

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it.each([
    ["1", 1],
    ["65535", 65535],
  ])("PORT が境界値 %j なら受け付ける", (port, expected) => {
    expect(parseEnv({ PORT: port }).PORT).toBe(expected);
  });

  it.each(["abc", "", "0", "65536", "3000.5"])(
    "PORT が %j なら検証エラーを投げる",
    (port) => {
      expect(() => parseEnv({ PORT: port })).toThrow();
    },
  );
});
