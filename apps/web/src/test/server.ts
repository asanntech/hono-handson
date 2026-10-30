import { setupServer } from "msw/node";

// テストごとに server.use(...) で、そのテストが前提とする API の応答を登録する
export const server = setupServer();
