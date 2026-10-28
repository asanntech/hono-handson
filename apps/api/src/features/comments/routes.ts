import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { MemberVariables } from "../../middleware/authorize.ts";
import { validator } from "../../middleware/validator.ts";
import { createComment, listComments, updateComment } from "./service.ts";

const commentSchema = z.object({
  body: z.string(),
});

// :taskId は親の tasks のパスにあり、このアプリのパスの型には含まれない。
// zValidator で UUID と確かめてから c.req.valid("param") で受け取る。
// tasks.id は uuid 型で、UUID でない値のまま問い合わせると DB の型エラーで 500 になるため、見つからないとして 404 にする
const taskParamValidator = zValidator(
  "param",
  z.object({ taskId: z.uuid() }),
  (result) => {
    if (!result.success) {
      throw new HTTPException(404);
    }
  },
);

// tasks のルートから /projects/:projectId/tasks/:taskId/comments につなぐ。
// ログインとメンバーの確認は、親の projects と tasks のミドルウェアが行う
export const comments = new Hono<{ Variables: MemberVariables }>()
  .post(
    "/",
    taskParamValidator,
    validator("json", commentSchema),
    async (c) => {
      const comment = await createComment(
        c.req.valid("param").taskId,
        c.get("userId"),
        c.req.valid("json"),
      );
      return c.json(comment, 201);
    },
  )
  .get("/", taskParamValidator, async (c) => {
    const taskComments = await listComments(c.req.valid("param").taskId);
    return c.json(taskComments, 200);
  })
  .patch("/:commentId", validator("json", commentSchema), async (c) => {
    const comment = await updateComment(
      c.req.param("commentId"),
      c.req.valid("json"),
    );
    return c.json(comment, 200);
  });
