import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

// 子ルートの loader が context.queryClient を型付きで使えるよう、context の型を宣言する
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: () => (
      <main className="mx-auto max-w-2xl p-6">
        <Outlet />
      </main>
    ),
  },
);
