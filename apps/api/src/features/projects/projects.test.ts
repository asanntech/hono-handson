import { eq } from "drizzle-orm";
import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";
import { db } from "../../db/client.ts";
import { projectMembers } from "../../db/schema.ts";

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
});
