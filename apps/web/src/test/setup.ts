import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { installFakeIntersectionObserver } from "./intersection-observer.ts";
import { server } from "./server.ts";

installFakeIntersectionObserver();

// 登録していない API が呼ばれたら、テストを失敗させる。想定外のリクエストを見逃さないため
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
