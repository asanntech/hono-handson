import { parseSetCookie } from "set-cookie-parser";
import { describe, expect, it, vi } from "vitest";
import { app } from "../app.ts";
import { newrelic } from "./client.ts";

describe("トランザクション名", () => {
  it("ルートに一致したリクエストでは、メソッドとルートのパスでトランザクション名を付ける", async () => {
    const signup = await app.request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
    });
    const [cookie] = parseSetCookie(signup);
    const createProject = await app.request("/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${cookie.value}`,
      },
      body: JSON.stringify({ name: "Project A" }),
    });
    const project = await createProject.json();
    const setTransactionName = vi.spyOn(newrelic, "setTransactionName");

    await app.request(`/projects/${project.id}/tasks`, {
      headers: { Cookie: `token=${cookie.value}` },
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
});
