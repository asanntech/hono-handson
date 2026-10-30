import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import { renderApp } from "../test/render.tsx";
import { server } from "../test/server.ts";

test.each(["/projects", "/projects/00000000-0000-4000-8000-000000000001"])(
  "未ログインで %s を開いたとき、ログイン画面へリダイレクトする",
  async (path) => {
    server.use(
      http.get("/api/auth/me", () =>
        HttpResponse.json(
          { error: { message: "Unauthorized" } },
          { status: 401 },
        ),
      ),
    );
    const { router } = renderApp(path);

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  },
);
