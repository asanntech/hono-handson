import { eq } from "drizzle-orm";
import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";
import { db } from "../../db/client.ts";
import { projectMembers, projects } from "../../db/schema.ts";

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
    const signupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const alice = await signupRes.json();
    const [cookie] = parseSetCookie(signupRes);

    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${cookie.value}`,
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
    const signupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const [cookie] = parseSetCookie(signupRes);

    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${cookie.value}`,
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
    const signupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const [cookie] = parseSetCookie(signupRes);

    const res = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${cookie.value}`,
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
      const signupRes = await app.request("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alice@example.com",
          password: "password123",
        }),
      });
      const [cookie] = parseSetCookie(signupRes);

      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${cookie.value}`,
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
    const aliceSignupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const alice = await aliceSignupRes.json();
    const [aliceCookie] = parseSetCookie(aliceSignupRes);
    const bobSignupRes = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bob@example.com",
        password: "password123",
      }),
    });
    const [bobCookie] = parseSetCookie(bobSignupRes);

    const createProject = async (cookie: string, name: string) => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${cookie}`,
        },
        body: JSON.stringify({ name }),
      });
      return res.json();
    };
    const aliceProject = await createProject(
      aliceCookie.value,
      "Alice Project",
    );
    const sharedProject = await createProject(
      bobCookie.value,
      "Shared Project",
    );
    await createProject(bobCookie.value, "Bob Project");
    // 招待 API はまだないので、alice を bob のプロジェクトの member として直接登録する
    await db.insert(projectMembers).values({
      projectId: sharedProject.id,
      userId: alice.id,
      role: "member",
    });

    const res = await app.request("/projects", {
      headers: { Cookie: `token=${aliceCookie.value}` },
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
});
