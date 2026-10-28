import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";
import { db } from "../../db/client.ts";
import { tasks } from "../../db/schema.ts";

// ユーザーを登録し、その id と、そのユーザーとしてリクエストするための Cookie ヘッダーの値を返す
const signupAs = async (email: string) => {
  const res = await app.request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const { id } = await res.json();
  const [cookie] = parseSetCookie(res);
  return { id: id as string, cookie: `token=${cookie.value}` };
};

// user としてプロジェクトを作り、作ったプロジェクトの { id, name } を返す。user は owner になる
const createProjectAs = async (user: { cookie: string }, name: string) => {
  const res = await app.request("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ name }),
  });
  return (await res.json()) as { id: string; name: string };
};

describe("POST /projects/:projectId/tasks", () => {
  it('メンバーが title を送ると 201 と { id, title, description: "", status: "todo", createdAt } を返す', async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");

    const res = await app.request(`/projects/${project.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({ title: "Design the top page" }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      title: "Design the top page",
      description: "",
      status: "todo",
      createdAt: expect.any(String),
    });
  });

  it("description と status を指定すると、その値で保存して返す", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");

    const res = await app.request(`/projects/${project.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({
        title: "Design the top page",
        description: "Use the new brand colors",
        status: "in_progress",
      }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      title: "Design the top page",
      description: "Use the new brand colors",
      status: "in_progress",
      createdAt: expect.any(String),
    });
  });
});

describe("GET /projects/:projectId/tasks", () => {
  it("そのプロジェクトのタスクだけを新しい順に { items, nextCursor: null } で返す", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    const otherProject = await createProjectAs(alice, "Mobile App");
    // 並び順を確かめるため、作成日時を指定して DB に直接入れる
    await db.insert(tasks).values([
      {
        projectId: project.id,
        title: "Older task",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        projectId: project.id,
        title: "Newer task",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        projectId: otherProject.id,
        title: "Task in another project",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);

    const res = await app.request(`/projects/${project.id}/tasks`, {
      headers: { Cookie: alice.cookie },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          id: expect.any(String),
          title: "Newer task",
          description: "",
          status: "todo",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: expect.any(String),
          title: "Older task",
          description: "",
          status: "todo",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      nextCursor: null,
    });
  });

  it("limit を指定すると limit 件と nextCursor を返し、nextCursor で続きを取得でき、最後のページでは nextCursor が null になる", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    await db.insert(tasks).values([
      {
        projectId: project.id,
        title: "Task 1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        projectId: project.id,
        title: "Task 2",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        projectId: project.id,
        title: "Task 3",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);

    const firstRes = await app.request(
      `/projects/${project.id}/tasks?limit=2`,
      { headers: { Cookie: alice.cookie } },
    );

    expect(firstRes.status).toBe(200);
    const firstPage = await firstRes.json();
    expect(
      firstPage.items.map((task: { title: string }) => task.title),
    ).toEqual(["Task 3", "Task 2"]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondRes = await app.request(
      `/projects/${project.id}/tasks?limit=2&cursor=${firstPage.nextCursor}`,
      { headers: { Cookie: alice.cookie } },
    );

    expect(secondRes.status).toBe(200);
    const secondPage = await secondRes.json();
    expect(
      secondPage.items.map((task: { title: string }) => task.title),
    ).toEqual(["Task 1"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("status を指定すると、その status のタスクだけを返し、絞り込んだままページングできる", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    await db.insert(tasks).values([
      {
        projectId: project.id,
        title: "Todo 1",
        status: "todo",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        projectId: project.id,
        title: "Done 1",
        status: "done",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        projectId: project.id,
        title: "Todo 2",
        status: "todo",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      {
        projectId: project.id,
        title: "Todo 3",
        status: "todo",
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
      },
    ]);

    const firstRes = await app.request(
      `/projects/${project.id}/tasks?status=todo&limit=2`,
      { headers: { Cookie: alice.cookie } },
    );

    expect(firstRes.status).toBe(200);
    const firstPage = await firstRes.json();
    expect(
      firstPage.items.map((task: { title: string }) => task.title),
    ).toEqual(["Todo 3", "Todo 2"]);

    const secondRes = await app.request(
      `/projects/${project.id}/tasks?status=todo&limit=2&cursor=${firstPage.nextCursor}`,
      { headers: { Cookie: alice.cookie } },
    );

    expect(secondRes.status).toBe(200);
    expect(await secondRes.json()).toEqual({
      items: [
        {
          id: expect.any(String),
          title: "Todo 1",
          description: "",
          status: "todo",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      nextCursor: null,
    });
  });
});

describe("GET /projects/:projectId/tasks/:taskId", () => {
  it("メンバーが呼ぶと 200 とタスクを返す", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    const createRes = await app.request(`/projects/${project.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({
        title: "Design the top page",
        description: "Use the new brand colors",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(
      `/projects/${project.id}/tasks/${created.id}`,
      { headers: { Cookie: alice.cookie } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: created.id,
      title: "Design the top page",
      description: "Use the new brand colors",
      status: "todo",
      createdAt: created.createdAt,
    });
  });
});
