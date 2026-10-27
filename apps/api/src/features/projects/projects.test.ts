import { eq } from "drizzle-orm";
import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";
import { db } from "../../db/client.ts";
import { projectMembers, projects } from "../../db/schema.ts";

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

describe("/projects 配下の認証", () => {
  // 存在しない ID でよい。認証はプロジェクトを探すより前に行うため
  const projectId = "00000000-0000-4000-8000-000000000000";
  const userId = "00000000-0000-4000-8000-000000000001";

  it.each([
    { method: "POST", path: "/projects" },
    { method: "GET", path: "/projects" },
    { method: "GET", path: `/projects/${projectId}` },
    { method: "PATCH", path: `/projects/${projectId}` },
    { method: "DELETE", path: `/projects/${projectId}` },
    { method: "GET", path: `/projects/${projectId}/members` },
    { method: "POST", path: `/projects/${projectId}/members` },
    { method: "DELETE", path: `/projects/${projectId}/members/${userId}` },
  ])(
    "Cookie を付けずに $method $path を呼ぶと 401 を返す",
    async ({ method, path }) => {
      const res = await app.request(path, { method });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: { message: "Unauthorized" } });
    },
  );
});

describe("POST /projects", () => {
  it("ログイン中のユーザーが name を送ると 201 と { id, name } を返し、作成者を owner として登録する", async () => {
    const alice = await signupAs("alice@example.com");

    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: alice.cookie,
      },
      body: JSON.stringify({ name: "Website Renewal" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: expect.any(String), name: "Website Renewal" });

    const members = await db
      .select({ userId: projectMembers.userId, role: projectMembers.role })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, body.id));
    expect(members).toEqual([{ userId: alice.id, role: "owner" }]);
  });

  it("name が 100 文字なら受け付けて 201 を返す", async () => {
    const alice = await signupAs("alice@example.com");

    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: alice.cookie,
      },
      body: JSON.stringify({ name: "a".repeat(100) }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      name: "a".repeat(100),
    });
  });

  it("name の前後に空白があれば、落としてから保存して返す", async () => {
    const alice = await signupAs("alice@example.com");

    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: alice.cookie,
      },
      body: JSON.stringify({ name: "  Website Renewal  " }),
    });

    expect(res.status).toBe(201);
    // レスポンスは INSERT ... RETURNING で返した、保存済みの値
    expect(await res.json()).toEqual({
      id: expect.any(String),
      name: "Website Renewal",
    });
  });

  it.each([
    { case: "101 文字", body: { name: "a".repeat(101) } },
    { case: "空文字", body: { name: "" } },
    { case: "空白だけ", body: { name: "   " } },
    { case: "未指定", body: {} },
  ])(
    "name が $case なら 400 を返し、プロジェクトを作らない",
    async ({ body }) => {
      const alice = await signupAs("alice@example.com");

      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: alice.cookie,
        },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: { message: "Bad Request" } });
      expect(await db.select().from(projects)).toEqual([]);
    },
  );
});

describe("GET /projects", () => {
  it("自分がメンバーになっているプロジェクトだけを、owner か member かに関わらず返す", async () => {
    const alice = await signupAs("alice@example.com");
    const bob = await signupAs("bob@example.com");

    const aliceProject = await createProjectAs(alice, "Alice Project");
    const sharedProject = await createProjectAs(bob, "Shared Project");
    await createProjectAs(bob, "Bob Project");
    // 招待 API はまだないので、alice を bob のプロジェクトの member として直接登録する
    await db.insert(projectMembers).values({
      projectId: sharedProject.id,
      userId: alice.id,
      role: "member",
    });

    const res = await app.request("/projects", {
      headers: { Cookie: alice.cookie },
    });

    expect(res.status).toBe(200);
    // 並び順はこの章では決めない（第6章のページネーションで決める）
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body).toEqual(
      expect.arrayContaining([
        { id: aliceProject.id, name: "Alice Project" },
        { id: sharedProject.id, name: "Shared Project" },
      ]),
    );
  });

  it("メンバーになっているプロジェクトが 1 件もなければ、他人のプロジェクトがあっても空の配列を返す", async () => {
    const alice = await signupAs("alice@example.com");
    const bob = await signupAs("bob@example.com");
    await createProjectAs(bob, "Bob Project");

    const res = await app.request("/projects", {
      headers: { Cookie: alice.cookie },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /projects/:projectId", () => {
  it("owner も member も 200 と { id, name } を受け取る", async () => {
    const alice = await signupAs("alice@example.com");
    const bob = await signupAs("bob@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    // 招待 API はまだないので、bob を member として直接登録する
    await db
      .insert(projectMembers)
      .values({ projectId: project.id, userId: bob.id, role: "member" });

    const ownerRes = await app.request(`/projects/${project.id}`, {
      headers: { Cookie: alice.cookie },
    });
    const memberRes = await app.request(`/projects/${project.id}`, {
      headers: { Cookie: bob.cookie },
    });

    expect(ownerRes.status).toBe(200);
    expect(await ownerRes.json()).toEqual({
      id: project.id,
      name: "Website Renewal",
    });
    expect(memberRes.status).toBe(200);
    expect(await memberRes.json()).toEqual({
      id: project.id,
      name: "Website Renewal",
    });
  });

  it("メンバーでなければ、存在しない ID を指定したときと同じ 404 を返す", async () => {
    const alice = await signupAs("alice@example.com");
    const carol = await signupAs("carol@example.com");
    const project = await createProjectAs(alice, "Website Renewal");

    const nonMemberRes = await app.request(`/projects/${project.id}`, {
      headers: { Cookie: carol.cookie },
    });
    const missingRes = await app.request(
      "/projects/00000000-0000-4000-8000-000000000000",
      { headers: { Cookie: carol.cookie } },
    );

    // ステータスも本文も同じにし、プロジェクトが存在するかどうかを区別させない
    expect(nonMemberRes.status).toBe(404);
    expect(await nonMemberRes.json()).toEqual({
      error: { message: "Not Found" },
    });
    expect(missingRes.status).toBe(404);
    expect(await missingRes.json()).toEqual({
      error: { message: "Not Found" },
    });
  });

  it("projectId が UUID の形でなければ、500 ではなく 404 を返す", async () => {
    const alice = await signupAs("alice@example.com");

    const res = await app.request("/projects/not-a-uuid", {
      headers: { Cookie: alice.cookie },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { message: "Not Found" } });
  });
});

describe("GET /projects/:projectId/members", () => {
  it("member が呼ぶと 200 と [{ userId, email, role }] を、メンバーに加わった順に返す", async () => {
    const alice = await signupAs("alice@example.com");
    const bob = await signupAs("bob@example.com");
    const carol = await signupAs("carol@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    // 招待 API はまだないので直接登録する。INSERT の順と加わった日時の順をわざと逆にし、
    // INSERT した順ではなく createdAt の順に並べていることを確かめる
    await db.insert(projectMembers).values({
      projectId: project.id,
      userId: bob.id,
      role: "member",
      createdAt: new Date("2030-01-02T00:00:00Z"),
    });
    await db.insert(projectMembers).values({
      projectId: project.id,
      userId: carol.id,
      role: "member",
      createdAt: new Date("2030-01-01T00:00:00Z"),
    });

    const res = await app.request(`/projects/${project.id}/members`, {
      headers: { Cookie: bob.cookie },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { userId: alice.id, email: "alice@example.com", role: "owner" },
      { userId: carol.id, email: "carol@example.com", role: "member" },
      { userId: bob.id, email: "bob@example.com", role: "member" },
    ]);
  });
});

describe("PATCH /projects/:projectId", () => {
  it("owner が name を送ると 200 と更新後の { id, name } を返す", async () => {
    const alice = await signupAs("alice@example.com");
    const project = await createProjectAs(alice, "Website Renewal");

    const res = await app.request(`/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({ name: "Website Renewal 2026" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: project.id,
      name: "Website Renewal 2026",
    });
  });
});

describe("DELETE /projects/:projectId", () => {
  it("owner が呼ぶと 204 を返し、プロジェクトとそのメンバー情報を消す", async () => {
    const alice = await signupAs("alice@example.com");
    const bob = await signupAs("bob@example.com");
    const project = await createProjectAs(alice, "Website Renewal");
    // 招待 API はまだないので、bob を member として直接登録する
    await db
      .insert(projectMembers)
      .values({ projectId: project.id, userId: bob.id, role: "member" });

    const res = await app.request(`/projects/${project.id}`, {
      method: "DELETE",
      headers: { Cookie: alice.cookie },
    });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(
      await db.select().from(projects).where(eq(projects.id, project.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, project.id)),
    ).toEqual([]);
  });
});

describe("owner だけができる操作", () => {
  it.each([
    { method: "PATCH", body: { name: "Hijacked" } },
    { method: "DELETE", body: undefined },
  ])(
    "member が $method /projects/:projectId を呼ぶと 403 を返し、プロジェクトを変更しない",
    async ({ method, body }) => {
      const alice = await signupAs("alice@example.com");
      const bob = await signupAs("bob@example.com");
      const project = await createProjectAs(alice, "Website Renewal");
      // 招待 API はまだないので、bob を member として直接登録する
      await db
        .insert(projectMembers)
        .values({ projectId: project.id, userId: bob.id, role: "member" });

      const res = await app.request(`/projects/${project.id}`, {
        method,
        headers: { "Content-Type": "application/json", Cookie: bob.cookie },
        body: body && JSON.stringify(body),
      });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: { message: "Forbidden" } });
      expect(
        await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(eq(projects.id, project.id)),
      ).toEqual([{ id: project.id, name: "Website Renewal" }]);
    },
  );
});

describe("メンバーでないユーザー", () => {
  it.each([
    { method: "PATCH", path: "", body: { name: "Hijacked" } },
    { method: "DELETE", path: "", body: undefined },
    { method: "GET", path: "/members", body: undefined },
  ])(
    "$method /projects/:projectId$path を呼ぶと 404 を返し、プロジェクトを変更しない",
    async ({ method, path, body }) => {
      const alice = await signupAs("alice@example.com");
      const carol = await signupAs("carol@example.com");
      const project = await createProjectAs(alice, "Website Renewal");

      const res = await app.request(`/projects/${project.id}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Cookie: carol.cookie },
        body: body && JSON.stringify(body),
      });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { message: "Not Found" } });
      expect(
        await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(eq(projects.id, project.id)),
      ).toEqual([{ id: project.id, name: "Website Renewal" }]);
    },
  );
});
