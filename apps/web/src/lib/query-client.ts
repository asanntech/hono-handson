import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api.ts";

// TanStack Query の既定と同じ回数。5xx やネットワークの一時的な失敗は、時間をおけば成功しうる
const MAX_RETRIES = 3;

// アプリとテストで同じ設定の QueryClient を使い、テストが本番と同じ条件（再試行など）で動くようにする
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // 4xx はリクエストの内容や権限の問題で、繰り返しても結果は変わらない。再試行せずにすぐエラーを表示する
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) &&
          failureCount < MAX_RETRIES,
      },
    },
  });
