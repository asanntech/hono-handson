import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";
import { db } from "../../db/client.ts";
import { comments } from "../../db/schema.ts";

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

// user としてプロジェクトにタスクを作り、作ったタスクの { id } を返す
const createTaskAs = async (
  user: { cookie: string },
  projectId: string,
  title: string,
) => {
  const res = await app.request(`/projects/${projectId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    body: JSON.stringify({ title }),
  });
  return (await res.json()) as { id: string };
};

describe("POST /projects/:projectId/tasks/:taskId/comments", () => {
  it("メンバーが body を送ると 201 と { id, body, authorId, createdAt } を返す", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    const task = await createTaskAs(alice, project.id, "Design the top page");

    const res = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: alice.cookie },
        body: JSON.stringify({ body: "Looks good to me" }),
      },
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      body: "Looks good to me",
      authorId: alice.id,
      createdAt: expect.any(String),
    });
  });

  it("body の前後の空白を落として保存し、2000 文字の body も受け付ける", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    const task = await createTaskAs(alice, project.id, "Design the top page");

    const trimmedRes = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: alice.cookie },
        body: JSON.stringify({ body: "  Looks good to me\n" }),
      },
    );
    const longRes = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: alice.cookie },
        body: JSON.stringify({ body: "a".repeat(2000) }),
      },
    );

    expect(trimmedRes.status).toBe(201);
    expect((await trimmedRes.json()).body).toBe("Looks good to me");
    expect(longRes.status).toBe(201);
    expect((await longRes.json()).body).toBe("a".repeat(2000));
  });
});

describe("GET /projects/:projectId/tasks/:taskId/comments", () => {
  it("そのタスクのコメントだけを古い順に返す", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    const task = await createTaskAs(alice, project.id, "Design the top page");
    const otherTask = await createTaskAs(alice, project.id, "Write the copy");
    for (const [taskId, body] of [
      [task.id, "First"],
      [otherTask.id, "On another task"],
      [task.id, "Second"],
    ]) {
      await app.request(`/projects/${project.id}/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: alice.cookie },
        body: JSON.stringify({ body }),
      });
    }

    const res = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments`,
      { headers: { Cookie: alice.cookie } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: expect.any(String),
        body: "First",
        authorId: alice.id,
        createdAt: expect.any(String),
      },
      {
        id: expect.any(String),
        body: "Second",
        authorId: alice.id,
        createdAt: expect.any(String),
      },
    ]);
  });
});

describe("PATCH /projects/:projectId/tasks/:taskId/comments/:commentId", () => {
  it("書いた本人が body を送ると、更新して 200 と更新後のコメントを返す", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    const task = await createTaskAs(alice, project.id, "Design the top page");
    const createRes = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: alice.cookie },
        body: JSON.stringify({ body: "Looks good to me" }),
      },
    );
    const created = await createRes.json();

    const res = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments/${created.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: alice.cookie },
        body: JSON.stringify({ body: "Looks good, but fix the header" }),
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ...created,
      body: "Looks good, but fix the header",
    });
    const listRes = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments`,
      { headers: { Cookie: alice.cookie } },
    );
    expect(await listRes.json()).toEqual([
      { ...created, body: "Looks good, but fix the header" },
    ]);
  });
});

describe("DELETE /projects/:projectId/tasks/:taskId/comments/:commentId", () => {
  it("書いた本人が呼ぶと 204 を返し、一覧から消える", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    const task = await createTaskAs(alice, project.id, "Design the top page");
    const createRes = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: alice.cookie },
        body: JSON.stringify({ body: "Looks good to me" }),
      },
    );
    const created = await createRes.json();

    const res = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments/${created.id}`,
      { method: "DELETE", headers: { Cookie: alice.cookie } },
    );

    expect(res.status).toBe(204);
    const listRes = await app.request(
      `/projects/${project.id}/tasks/${task.id}/comments`,
      { headers: { Cookie: alice.cookie } },
    );
    expect(await listRes.json()).toEqual([]);
  });
});

describe("タスクとプロジェクトの削除", () => {
  it.each([
    {
      case: "タスク",
      pathOf: (projectId: string, taskId: string) =>
        `/projects/${projectId}/tasks/${taskId}`,
    },
    {
      case: "プロジェクト",
      pathOf: (projectId: string) => `/projects/${projectId}`,
    },
  ])("$case を削除すると、そのタスクのコメントも消える", async ({ pathOf }) => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    const task = await createTaskAs(alice, project.id, "Design the top page");
    await app.request(`/projects/${project.id}/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({ body: "Looks good to me" }),
    });

    const res = await app.request(pathOf(project.id, task.id), {
      method: "DELETE",
      headers: { Cookie: alice.cookie },
    });

    expect(res.status).toBe(204);
    expect(await db.select().from(comments)).toEqual([]);
  });
});
