import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { createQueryClient } from "../lib/query-client.ts";
import { createAppRouter } from "../lib/router.ts";

// 指定したパスからアプリ全体を描画する。テスト間で状態が漏れないよう、ルーターとキャッシュは毎回作る
export const renderApp = (path: string) => {
  const queryClient = createQueryClient();
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [path] }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
};
