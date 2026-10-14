import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    // vi.spyOn で差し替えた関数を、テストが失敗しても各テストの後に元に戻す
    restoreMocks: true,
  },
});
