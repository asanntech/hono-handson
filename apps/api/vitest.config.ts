import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// ルートの .env からテスト用 DB の接続先を読み、アプリが読む DATABASE_URL として渡す
const { TEST_DATABASE_URL } = parseEnv(
  readFileSync(new URL("../../.env", import.meta.url), "utf8"),
);

export default defineConfig({
  test: {
    passWithNoTests: true,
    // vi.spyOn で差し替えた関数を、テストが失敗しても各テストの後に元に戻す
    restoreMocks: true,
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
});
