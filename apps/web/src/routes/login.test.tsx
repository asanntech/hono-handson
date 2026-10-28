import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InferResponseType } from "hono/client";
import { HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import type { api } from "../lib/api.ts";
import { renderApp } from "../test/render.tsx";
import { server } from "../test/server.ts";

type LoginResponse = InferResponseType<typeof api.auth.login.$post, 200>;

test("正しいメールアドレスとパスワードでログインしたとき、プロジェクト一覧画面へ遷移する", async () => {
  let requestBody: unknown;
  server.use(
    http.post("/api/auth/login", async ({ request }) => {
      requestBody = await request.json();
      return HttpResponse.json<LoginResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      });
    }),
  );
  const { router } = renderApp("/login");
  const user = userEvent.setup();

  await user.type(
    await screen.findByLabelText("メールアドレス"),
    "alice@example.com",
  );
  await user.type(screen.getByLabelText("パスワード"), "password123");
  await user.click(screen.getByRole("button", { name: "ログイン" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/projects"));
  expect(requestBody).toEqual({
    email: "alice@example.com",
    password: "password123",
  });
});
