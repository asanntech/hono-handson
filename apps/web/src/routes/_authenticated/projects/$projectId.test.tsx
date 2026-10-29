import { screen, within } from "@testing-library/react";
import type { InferResponseType } from "hono/client";
import { delay, HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import type { api } from "../../../lib/api.ts";
import { scrollIntoViewAll } from "../../../test/intersection-observer.ts";
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

test("タスク一覧の末尾までスクロールしたとき、次のページを読み込んで後ろに追加する", async () => {
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get(
      "/api/projects/00000000-0000-4000-8000-0000000000a1/tasks",
      ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (cursor === null) {
          return HttpResponse.json<TasksResponse>({
            items: [
              {
                id: "00000000-0000-4000-8000-0000000000b1",
                title: "Write the spec",
                description: "",
                status: "in_progress",
                createdAt: "2026-10-01T00:00:00.000Z",
              },
            ],
            nextCursor: "cursor-after-b1",
          });
        }
        if (cursor === "cursor-after-b1") {
          return HttpResponse.json<TasksResponse>({
            items: [
              {
                id: "00000000-0000-4000-8000-0000000000b2",
                title: "Design the API",
                description: "",
                status: "done",
                createdAt: "2026-09-30T00:00:00.000Z",
              },
            ],
            nextCursor: null,
          });
        }
        return HttpResponse.json(
          { error: { message: "Bad Request" } },
          { status: 400 },
        );
      },
    ),
  );
  renderApp("/projects/00000000-0000-4000-8000-0000000000a1");
  expect(await screen.findByText("Write the spec")).toBeInTheDocument();

  scrollIntoViewAll();

  expect(await screen.findByText("Design the API")).toBeInTheDocument();
  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("Write the spec");
  expect(items[1]).toHaveTextContent("Design the API");
});

test("最後のページ（nextCursor が null）まで読み込んだとき、末尾までスクロールしても、それ以上リクエストしない", async () => {
  let requestCount = 0;
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get("/api/projects/00000000-0000-4000-8000-0000000000a1/tasks", () => {
      requestCount++;
      return HttpResponse.json<TasksResponse>({
        items: [
          {
            id: "00000000-0000-4000-8000-0000000000b1",
            title: "Write the spec",
            description: "",
            status: "in_progress",
            createdAt: "2026-10-01T00:00:00.000Z",
          },
        ],
        nextCursor: null,
      });
    }),
  );
  renderApp("/projects/00000000-0000-4000-8000-0000000000a1");
  expect(await screen.findByText("Write the spec")).toBeInTheDocument();

  scrollIntoViewAll();
  // リクエストが「起きない」ことは待って確かめるしかない。起きるなら、この間に MSW へ届く
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(requestCount).toBe(1);
});

test("最初のページを読み込んでいる途中で末尾が画面に入ったとき、同じページを重ねてリクエストしない", async () => {
  let requestCount = 0;
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get(
      "/api/projects/00000000-0000-4000-8000-0000000000a1/tasks",
      async () => {
        requestCount++;
        // 末尾が画面に入るまで、最初のページの応答を遅らせる
        await delay(50);
        return HttpResponse.json<TasksResponse>({
          items: [
            {
              id: "00000000-0000-4000-8000-0000000000b1",
              title: "Write the spec",
              description: "",
              status: "in_progress",
              createdAt: "2026-10-01T00:00:00.000Z",
            },
          ],
          nextCursor: "cursor-after-b1",
        });
      },
    ),
  );
  renderApp("/projects/00000000-0000-4000-8000-0000000000a1");
  // 一覧がまだ空のうちは、末尾の要素がすぐ画面に入る
  await screen.findByRole("heading", { name: "タスク" });
  scrollIntoViewAll();

  expect(await screen.findByText("Write the spec")).toBeInTheDocument();
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(requestCount).toBe(1);
});

test("タスクが 0 件のとき、「タスクがありません」と表示する", async () => {
  server.use(
    http.get("/api/auth/me", () =>
      HttpResponse.json<MeResponse>({
        id: "00000000-0000-4000-8000-000000000001",
        email: "alice@example.com",
      }),
    ),
    http.get("/api/projects/00000000-0000-4000-8000-0000000000a1/tasks", () =>
      HttpResponse.json<TasksResponse>({ items: [], nextCursor: null }),
    ),
  );
  renderApp("/projects/00000000-0000-4000-8000-0000000000a1");

  expect(await screen.findByText("タスクがありません")).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});
