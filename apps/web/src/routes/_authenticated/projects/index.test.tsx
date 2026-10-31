import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InferResponseType } from "hono/client";
import { HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import type { api } from "../../../lib/api.ts";
import { renderApp } from "../../../test/render.tsx";
import { server } from "../../../test/server.ts";

type MeResponse = InferResponseType<typeof api.auth.me.$get, 200>;
type ProjectsResponse = InferResponseType<typeof api.projects.$get, 200>;
type TasksResponse = InferResponseType<
  (typeof api.projects)[":projectId"]["tasks"]["$get"],
  200
>;

test("プロジェクト一覧を開いたとき、所属するプロジェクトの名前が、そのタスク一覧へのリンクとして並ぶ", async () => {
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get("/api/projects", () =>
      HttpResponse.json<ProjectsResponse>([
        { id: "00000000-0000-4000-8000-0000000000a1", name: "Website" },
        { id: "00000000-0000-4000-8000-0000000000a2", name: "Mobile App" },
      ]),
    ),
  );
  renderApp("/projects");

  expect(await screen.findByRole("link", { name: "Website" })).toHaveAttribute(
    "href",
    "/projects/00000000-0000-4000-8000-0000000000a1",
  );
  expect(screen.getByRole("link", { name: "Mobile App" })).toHaveAttribute(
    "href",
    "/projects/00000000-0000-4000-8000-0000000000a2",
  );
});

test("プロジェクト一覧を開いたとき、見出しと一緒にプロジェクトの一覧を表示する（見出しだけの画面を出さない）", async () => {
  let requestCount = 0;
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get("/api/projects", () => {
      requestCount++;
      return HttpResponse.json<ProjectsResponse>([
        { id: "00000000-0000-4000-8000-0000000000a1", name: "Website" },
      ]);
    }),
  );
  renderApp("/projects");

  // 見出しが出た時点で、待たずに一覧があること。データがそろうまで画面を描画しないため
  await screen.findByRole("heading", { name: "プロジェクト" });
  expect(screen.getByRole("link", { name: "Website" })).toBeInTheDocument();
  // loader が取得したキャッシュで描画し、コンポーネントが取得し直さないこと。queryKey がずれると 2 回になる
  expect(requestCount).toBe(1);
});

test("所属するプロジェクトが 0 件のとき、「プロジェクトがありません」と表示する", async () => {
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get("/api/projects", () => HttpResponse.json<ProjectsResponse>([])),
  );
  renderApp("/projects");

  expect(
    await screen.findByText("プロジェクトがありません"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

test("プロジェクト一覧でプロジェクトのリンクにホバーしたとき、クリックする前にそのタスク一覧を取得する", async () => {
  let tasksRequested = false;
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get("/api/projects", () =>
      HttpResponse.json<ProjectsResponse>([
        { id: "00000000-0000-4000-8000-0000000000a1", name: "Website" },
      ]),
    ),
    http.get("/api/projects/00000000-0000-4000-8000-0000000000a1/tasks", () => {
      tasksRequested = true;
      return HttpResponse.json<TasksResponse>({ items: [], nextCursor: null });
    }),
  );
  const user = userEvent.setup();
  const { router } = renderApp("/projects");

  await user.hover(await screen.findByRole("link", { name: "Website" }));

  await waitFor(() => expect(tasksRequested).toBe(true));
  expect(router.state.location.pathname).toBe("/projects");
});
