import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { MemberVariables } from "../../middleware/authorize.ts";
import { validator } from "../../middleware/validator.ts";
import { findTask } from "../tasks/service.ts";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "./service.ts";

const commentSchema = z.object({
  // 前後の空白や改行は、入力のときに紛れ込んだもので意味を持たないため落とす
  body: z.string().trim(),
});

// requireMember の後に置き、パスの :taskId がそのプロジェクトのタスクでなければ 404 にする。
// 別のプロジェクトのタスク ID を指定されても、存在しない ID と同じ 404 にし、そのタスクのコメントを読み書きさせない。
// :taskId は親の tasks のパスにあり、このアプリのパスの型には含まれないため、確かめた ID を c.get("taskId") で渡す
const requireTask = createMiddleware<{
  Variables: MemberVariables & { taskId: string };
}>(async (c, next) => {
  // tasks.id は uuid 型。UUID でない値のまま問い合わせると、DB の型エラーで 500 になる
  const taskId = z.uuid().safeParse(c.req.param("taskId"));
  if (!taskId.success) {
    throw new HTTPException(404);
  }
  await findTask(c.get("projectId"), taskId.data);
  c.set("taskId", taskId.data);
  await next();
});

// tasks のルートから /projects/:projectId/tasks/:taskId/comments につなぐ。
// ログインとメンバーの確認は、親の projects と tasks のミドルウェアが行う。
// comments の操作はどれもタスクがそのプロジェクトのものである必要があるので、先頭でまとめて requireTask を掛ける
export const comments = new Hono()
  .use(requireTask)
  .post("/", validator("json", commentSchema), async (c) => {
    const comment = await createComment(
      c.get("taskId"),
      c.get("userId"),
      c.req.valid("json"),
    );
    return c.json(comment, 201);
  })
  .get("/", async (c) => {
    const taskComments = await listComments(c.get("taskId"));
    return c.json(taskComments, 200);
  })
  .patch("/:commentId", validator("json", commentSchema), async (c) => {
    const comment = await updateComment(
      c.req.param("commentId"),
      c.get("userId"),
      c.req.valid("json"),
    );
    return c.json(comment, 200);
  })
  .delete("/:commentId", async (c) => {
    await deleteComment(c.req.param("commentId"), c.get("userId"));
    return c.body(null, 204);
  });
