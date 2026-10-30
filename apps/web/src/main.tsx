import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createQueryClient } from "./lib/query-client.ts";
import { routeTree } from "./routeTree.gen.ts";

const queryClient = createQueryClient();
const router = createRouter({ routeTree });

// useNavigate や Link の to に、存在するパスだけを書けるよう、ルーターの型を登録する
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root が見つかりません");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
