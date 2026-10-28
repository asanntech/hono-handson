import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { routeTree } from "../routeTree.gen.ts";

// 指定したパスからアプリ全体を描画する。テスト間で状態が漏れないよう、ルーターとキャッシュは毎回作る
export const renderApp = (path: string) => {
  const queryClient = new QueryClient({
    // 失敗したリクエストを再試行すると、エラーの表示を待つテストが遅くなる
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
};
