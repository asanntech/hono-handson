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

  it.each([
    { case: "101 文字", body: { name: "a".repeat(101) } },
    { case: "空文字", body: { name: "" } },
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
