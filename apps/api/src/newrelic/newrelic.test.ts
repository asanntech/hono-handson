import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it, vi } from "vitest";
import { app } from "../app.ts";
import { newrelic } from "./client.ts";

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

describe("トランザクション名", () => {
  it("ルートに一致したリクエストでは、メソッドとルートのパスでトランザクション名を付ける", async () => {
    const alice = await signupAs("alice@example.com");
    const createProject = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: alice.cookie,
      },
      body: JSON.stringify({ name: "Project A" }),
    });
    const project = await createProject.json();
    const setTransactionName = vi.spyOn(newrelic, "setTransactionName");

    await app.request(`/projects/${project.id}/tasks`, {
      headers: { Cookie: alice.cookie },
    });

    expect(setTransactionName).toHaveBeenCalledWith(
      "GET /projects/:projectId/tasks",
    );
  });

  it("ログインが要らないルートでも、メソッドとルートのパスでトランザクション名を付ける", async () => {
    const setTransactionName = vi.spyOn(newrelic, "setTransactionName");

    await app.request("/health");

    expect(setTransactionName).toHaveBeenCalledWith("GET /health");
  });

  // パスごとに名前が増えると、存在しない URL を大量に叩かれただけで New Relic のトランザクションの一覧が埋まる
  it("存在しないパスへのリクエストは、パスによらず同じトランザクション名にまとめる", async () => {
    const setTransactionName = vi.spyOn(newrelic, "setTransactionName");

    await app.request("/no-such-path");
    await app.request("/another/missing/path");

    expect(setTransactionName).toHaveBeenNthCalledWith(1, "GET /*");
    expect(setTransactionName).toHaveBeenNthCalledWith(2, "GET /*");
  });
});

describe("カスタム属性", () => {
  it("どのリクエストでも、requestId をカスタム属性に付ける", async () => {
    const addCustomAttributes = vi.spyOn(newrelic, "addCustomAttributes");

    const res = await app.request("/health");

    expect(addCustomAttributes).toHaveBeenCalledWith({
      requestId: res.headers.get("x-request-id"),
    });
  });

  it("ログイン済みのリクエストでは、userId をカスタム属性に付ける", async () => {
    const alice = await signupAs("alice@example.com");
    const addCustomAttributes = vi.spyOn(newrelic, "addCustomAttributes");

    await app.request("/projects", {
      headers: { Cookie: alice.cookie },
    });

    expect(addCustomAttributes).toHaveBeenCalledWith({ userId: alice.id });
  });
});
