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
    // JWT_SECRET はテストで同じ値を使えばよいため、固定値を渡す。
    // ログは vi.spyOn で呼び出しを検証するため出力は要らず、テストの結果表示を埋めないよう silent にする
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "test-jwt-secret-at-least-32-characters",
      LOG_MIN_LEVEL: "silent",
      // テストではエージェントを無効にし、New Relic にデータを送らない。API の呼び出しは vi.spyOn で検証する
      NEW_RELIC_ENABLED: "false",
      // 無効にしてもエージェント自身のログ（newrelic_agent.log）は書かれるため、それも止める
      NEW_RELIC_LOG_ENABLED: "false",
    },
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // テストファイルが同じ DB を同時に TRUNCATE し合わないよう、ファイルを 1 つずつ実行する
    fileParallelism: false,
  },
});
