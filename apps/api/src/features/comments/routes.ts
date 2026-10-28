import { zValidator } from "@hono/zod-validator";
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
  // 前後の空白や改行は、入力のときに紛れ込んだもので意味を持たないため落とす。
  // trim を先に置くと、空白を落とした後の文字数で min / max を判定する。空白だけの body は空文字になり弾かれる
  body: z.string().trim().min(1).max(2000),
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

// comments.id は uuid 型。UUID でない値のまま問い合わせると、DB の型エラーで 500 になる。
// UUID の形でない ID が指すコメントはないので、400 ではなく見つからないとして扱う
const commentParamValidator = zValidator(
  "param",
  z.object({ commentId: z.uuid() }),
  (result) => {
    if (!result.success) {
      throw new HTTPException(404);
    }
  },
);

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
  .patch(
    "/:commentId",
    commentParamValidator,
    validator("json", commentSchema),
    async (c) => {
      const comment = await updateComment(
        c.get("taskId"),
        c.req.valid("param").commentId,
        c.get("userId"),
        c.req.valid("json"),
      );
      return c.json(comment, 200);
    },
  )
  .delete("/:commentId", commentParamValidator, async (c) => {
    await deleteComment(
      c.get("taskId"),
      c.req.valid("param").commentId,
      c.get("userId"),
    );
    return c.body(null, 204);
  });
