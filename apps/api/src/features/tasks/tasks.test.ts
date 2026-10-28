import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it } from "vitest";
import { app } from "../../app.ts";

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
