import type { QueryClient } from "@tanstack/react-query";
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { routeTree } from "../routeTree.gen.ts";

// アプリとテストで同じ設定のルーターを使う。loader が queryClient を使えるよう、context で渡す。
// queryClient を import せず受け取るのは、テストごとに新しいキャッシュを使えるようにするため
export const createAppRouter = (
  queryClient: QueryClient,
  history?: RouterHistory,
) =>
  createRouter({
    routeTree,
    context: { queryClient },
    history,
    // リンクにホバーやフォーカスしたとき、遷移先の loader を先に実行して、クリック後の待ち時間を減らす
    defaultPreload: "intent",
    // データの鮮度は Query のキャッシュ（staleTime）で判断する。Router 側では先読みの結果を使い回さず、毎回 loader を呼ぶ
    defaultPreloadStaleTime: 0,
  });

// useNavigate や Link の to に、存在するパスだけを書けるよう、ルーターの型を登録する
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
