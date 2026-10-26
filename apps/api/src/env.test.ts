import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";

// 必須の環境変数。ほかの項目を検証するテストで、入力に含めておく
const requiredEnv = { DATABASE_URL: "postgres://user:pass@localhost:5432/app" };

describe("parseEnv", () => {
  it("PORT が指定されると数値に変換して返す", () => {
    const env = parseEnv({ ...requiredEnv, PORT: "8080" });

    expect(env.PORT).toBe(8080);
  });

  it("NODE_ENV が指定されるとその値を返す", () => {
    const env = parseEnv({ ...requiredEnv, NODE_ENV: "production" });

    expect(env.NODE_ENV).toBe("production");
  });

  it.each([
    "postgres://user:pass@localhost:5432/app",
    "postgresql://user:pass@localhost:5432/app",
  ])("DATABASE_URL が %j ならその値を返す", (url) => {
    const env = parseEnv({ DATABASE_URL: url });

    expect(env.DATABASE_URL).toBe(url);
  });

  it("PORT と NODE_ENV が未指定なら 3000 と development を既定値にする", () => {
    const env = parseEnv(requiredEnv);

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it.each([
    ["1", 1],
    ["65535", 65535],
  ])("PORT が境界値 %j なら受け付ける", (port, expected) => {
    expect(parseEnv({ ...requiredEnv, PORT: port }).PORT).toBe(expected);
  });

  it.each(["abc", "", "0", "65536", "3000.5"])(
    "PORT が %j なら検証エラーを投げる",
    (port) => {
      expect(() => parseEnv({ ...requiredEnv, PORT: port })).toThrow();
    },
  );

  it("NODE_ENV が development / test / production 以外なら検証エラーを投げる", () => {
    expect(() => parseEnv({ ...requiredEnv, NODE_ENV: "staging" })).toThrow();
  });

  it.each([undefined, "", "not-a-url", "http://localhost:5432/app"])(
    "DATABASE_URL が %j なら検証エラーを投げる",
    (url) => {
      expect(() => parseEnv({ DATABASE_URL: url })).toThrow();
    },
  );
});
