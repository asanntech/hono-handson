import { screen, within } from "@testing-library/react";
import type { InferResponseType } from "hono/client";
import { HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import type { api } from "../../../lib/api.ts";
import { renderApp } from "../../../test/render.tsx";
import { server } from "../../../test/server.ts";

type MeResponse = InferResponseType<typeof api.auth.me.$get, 200>;
type TasksResponse = InferResponseType<
  (typeof api.projects)[":projectId"]["tasks"]["$get"],
  200
>;

test("タスク一覧を開いたとき、最初のページのタスクのタイトルとステータスを表示する", async () => {
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get("/api/projects/00000000-0000-4000-8000-0000000000a1/tasks", () =>
      HttpResponse.json<TasksResponse>({
        items: [
          {
            id: "00000000-0000-4000-8000-0000000000b1",
            title: "Write the spec",
            description: "",
            status: "in_progress",
            createdAt: "2026-10-01T00:00:00.000Z",
          },
          {
            id: "00000000-0000-4000-8000-0000000000b2",
            title: "Design the API",
            description: "",
            status: "done",
            createdAt: "2026-09-30T00:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
    ),
  );
  renderApp("/projects/00000000-0000-4000-8000-0000000000a1");

  const items = await screen.findAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(within(items[0]).getByText("Write the spec")).toBeInTheDocument();
  expect(within(items[0]).getByText("進行中")).toBeInTheDocument();
  expect(within(items[1]).getByText("Design the API")).toBeInTheDocument();
  expect(within(items[1]).getByText("完了")).toBeInTheDocument();
});
