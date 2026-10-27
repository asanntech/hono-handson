import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { signup } from "../auth/service.ts";
import { addMember, findProject, updateProject } from "./service.ts";

// 認可のミドルウェアを通った後、サービス関数が動くまでの間に owner がプロジェクトを削除した場合を想定する。
// HTTP では間隔を再現できないため、存在しない ID でサービス関数を直接呼ぶ
const deletedProjectId = "00000000-0000-4000-8000-000000000000";

describe("認可の後でプロジェクトが消えていた場合", () => {
  it("findProject は 404 を投げる（200 の空ボディを返さない）", async () => {
    await expect(findProject(deletedProjectId)).rejects.toMatchObject({
      constructor: HTTPException,
      status: 404,
    });
  });

  it("updateProject は 404 を投げる（200 の空ボディを返さない）", async () => {
    await expect(
      updateProject(deletedProjectId, { name: "Website Renewal" }),
    ).rejects.toMatchObject({ constructor: HTTPException, status: 404 });
  });

  it("addMember は外部キー違反を 404 にして投げる（500 にしない）", async () => {
    await signup({ email: "bob@example.com", password: "password123" });

    await expect(
      addMember(deletedProjectId, "bob@example.com"),
    ).rejects.toMatchObject({ constructor: HTTPException, status: 404 });
  });
});
