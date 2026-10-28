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

// owner としてプロジェクトに、email のユーザーをメンバーとして招待する
const inviteAs = async (
  owner: { cookie: string },
  projectId: string,
  email: string,
) => {
  await app.request(`/projects/${projectId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: owner.cookie },
    body: JSON.stringify({ email }),
  });
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

describe("/projects/:projectId/tasks/:taskId/comments 配下の認証", () => {
  // 存在しない ID でよい。認証はプロジェクトやタスク、コメントを探すより前に行うため
  const base =
    "/projects/00000000-0000-4000-8000-000000000000/tasks/00000000-0000-4000-8000-000000000001/comments";
  const commentId = "00000000-0000-4000-8000-000000000002";

  it.each([
    { method: "POST", path: base },
    { method: "GET", path: base },
    { method: "PATCH", path: `${base}/${commentId}` },
    { method: "DELETE", path: `${base}/${commentId}` },
  ])(
    "Cookie を付けずに $method $path を呼ぶと 401 を返す",
    async ({ method, path }) => {
      const res = await app.request(path, { method });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: { message: "Unauthorized" } });
    },
  );
});

describe("メンバーでないユーザー", () => {
  it.each([
    { method: "POST", path: "", body: { body: "Hijacked" } },
    { method: "GET", path: "" },
    { method: "PATCH", path: "/:commentId", body: { body: "Hijacked" } },
    { method: "DELETE", path: "/:commentId" },
  ])(
    "$method /projects/:projectId/tasks/:taskId/comments$path を呼ぶと 404 を返し、コメントを変えない",
    async ({ method, path, body }) => {
      const alice = await signupAs("alice@example.com");
      const bob = await signupAs("bob@example.com");
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
        `/projects/${project.id}/tasks/${task.id}/comments${path.replace(":commentId", created.id)}`,
        {
          method,
          headers: { "Content-Type": "application/json", Cookie: bob.cookie },
          body: body && JSON.stringify(body),
        },
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { message: "Not Found" } });
      expect(
        await db
          .select({ id: comments.id, body: comments.body })
          .from(comments),
      ).toEqual([{ id: created.id, body: "Looks good to me" }]);
    },
  );
});

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

describe("/projects/:projectId/tasks/:taskId/comments で見つからないタスク", () => {
  const methods = [
    { method: "POST", path: "", body: { body: "Hijacked" } },
    { method: "GET", path: "" },
    { method: "PATCH", path: "/:commentId", body: { body: "Hijacked" } },
    { method: "DELETE", path: "/:commentId" },
  ];
  // 呼ぶ人は両方のプロジェクトのメンバーで、コメントを書いた本人。
  // 別のプロジェクトのタスクは、パスのプロジェクトからは見えないものとして扱う
  const taskIds = [
    {
      case: "別のプロジェクトのタスク ID",
      taskIdOf: (otherProjectTask: { id: string }) => otherProjectTask.id,
    },
    {
      case: "存在しない ID",
      taskIdOf: () => "00000000-0000-4000-8000-000000000000",
    },
    { case: "UUID の形でない ID", taskIdOf: () => "not-a-uuid" },
  ];

  it.each(
    methods.flatMap((method) => taskIds.map((id) => ({ ...method, ...id }))),
  )(
    "$method で$case を指定すると 404 を返し、コメントを変えない",
    async ({ method, path, body, taskIdOf }) => {
      const alice = await signupAs("alice@example.com");
      const project = await createProjectAs(alice, "Website Renewal");
      const otherProject = await createProjectAs(alice, "Mobile App");
      const otherProjectTask = await createTaskAs(
        alice,
        otherProject.id,
        "Design the top page",
      );
      const createRes = await app.request(
        `/projects/${otherProject.id}/tasks/${otherProjectTask.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: alice.cookie },
          body: JSON.stringify({ body: "Looks good to me" }),
        },
      );
      const created = await createRes.json();

      const res = await app.request(
        `/projects/${project.id}/tasks/${taskIdOf(otherProjectTask)}/comments${path.replace(":commentId", created.id)}`,
        {
          method,
          headers: { "Content-Type": "application/json", Cookie: alice.cookie },
          body: body && JSON.stringify(body),
        },
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { message: "Not Found" } });
      expect(
        await db
          .select({ id: comments.id, body: comments.body })
          .from(comments),
      ).toEqual([{ id: created.id, body: "Looks good to me" }]);
    },
  );
});

describe("/projects/:projectId/tasks/:taskId/comments/:commentId で見つからないコメント", () => {
  const methods = [
    { method: "PATCH", body: { body: "Hijacked" } },
    { method: "DELETE" },
  ];
  // 呼ぶ人はコメントを書いた本人。別のタスクのコメントは、パスのタスクからは見えないものとして扱う
  const commentIds = [
    {
      case: "別のタスクのコメント ID",
      commentIdOf: (otherTaskComment: { id: string }) => otherTaskComment.id,
    },
    {
      case: "存在しない ID",
      commentIdOf: () => "00000000-0000-4000-8000-000000000000",
    },
    { case: "UUID の形でない ID", commentIdOf: () => "not-a-uuid" },
  ];

  it.each(
    methods.flatMap((method) => commentIds.map((id) => ({ ...method, ...id }))),
  )(
    "$method で$case を指定すると 404 を返し、コメントを変えない",
    async ({ method, body, commentIdOf }) => {
      const alice = await signupAs("alice@example.com");
      const project = await createProjectAs(alice, "Website Renewal");
      const task = await createTaskAs(alice, project.id, "Design the top page");
      const otherTask = await createTaskAs(alice, project.id, "Write the copy");
      const createRes = await app.request(
        `/projects/${project.id}/tasks/${otherTask.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: alice.cookie },
          body: JSON.stringify({ body: "Looks good to me" }),
        },
      );
      const otherTaskComment = await createRes.json();

      const res = await app.request(
        `/projects/${project.id}/tasks/${task.id}/comments/${commentIdOf(otherTaskComment)}`,
        {
          method,
          headers: { "Content-Type": "application/json", Cookie: alice.cookie },
          body: body && JSON.stringify(body),
        },
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { message: "Not Found" } });
      expect(
        await db
          .select({ id: comments.id, body: comments.body })
          .from(comments),
      ).toEqual([{ id: otherTaskComment.id, body: "Looks good to me" }]);
    },
  );
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

describe("コメントを書いた本人でないメンバー", () => {
  it.each([
    { method: "PATCH", body: { body: "Hijacked" } },
    { method: "DELETE" },
  ])(
    "$method すると、プロジェクトの owner でも別のメンバーでも 403 を返し、コメントを変えない",
    async ({ method, body }) => {
      const alice = await signupAs("alice@example.com");
      const bob = await signupAs("bob@example.com");
      const carol = await signupAs("carol@example.com");
      const project = await createProjectAs(alice, "Website Renewal");
      await inviteAs(alice, project.id, "bob@example.com");
      await inviteAs(alice, project.id, "carol@example.com");
      const task = await createTaskAs(alice, project.id, "Design the top page");
      const createRes = await app.request(
        `/projects/${project.id}/tasks/${task.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: bob.cookie },
          body: JSON.stringify({ body: "Looks good to me" }),
        },
      );
      const created = await createRes.json();

      // alice はプロジェクトの owner、carol は bob と同じただのメンバー
      for (const other of [alice, carol]) {
        const res = await app.request(
          `/projects/${project.id}/tasks/${task.id}/comments/${created.id}`,
          {
            method,
            headers: {
              "Content-Type": "application/json",
              Cookie: other.cookie,
            },
            body: body && JSON.stringify(body),
          },
        );

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: { message: "Forbidden" } });
      }
      const listRes = await app.request(
        `/projects/${project.id}/tasks/${task.id}/comments`,
        { headers: { Cookie: bob.cookie } },
      );
      expect(await listRes.json()).toEqual([created]);
    },
  );
});
