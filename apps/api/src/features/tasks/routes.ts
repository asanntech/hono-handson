import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { taskStatus } from "../../db/schema.ts";
import { requireMember } from "../../middleware/authorize.ts";
import { validator } from "../../middleware/validator.ts";
import { comments } from "../comments/routes.ts";
import {
  createTask,
  deleteTask,
  findTask,
  listTasks,
  updateTask,
} from "./service.ts";

const createTaskSchema = z.object({
  // trim を先に置くと、空白を落とした後の文字数で min / max を判定する。空白だけの title は空文字になり弾かれる
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(taskStatus.enumValues).optional(),
});

// PATCH は送った項目だけを更新する。1 つも送られなければ更新する内容がないので 400 にする
// （そのまま UPDATE すると、Drizzle が SET 句を作れずに例外を投げて 500 になる）
const updateTaskSchema = createTaskSchema
  .partial()
  .refine((input) => Object.values(input).some((value) => value !== undefined));

const listTasksQuerySchema = z.object({
  // クエリパラメータは文字列で届くため、coerce で数値に変換してから検証する
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(taskStatus.enumValues).optional(),
});

// limit の上限は、API の型からは分からない。範囲外のときだけ、指定できる範囲をメッセージで伝える。
// それ以外の失敗は、共通の validator と同じく Bad Request にそろえる
const listTasksQueryValidator = zValidator(
  "query",
  listTasksQuerySchema,
  (result) => {
    if (!result.success) {
      const message = result.error.issues.some(
        (issue) => issue.path[0] === "limit",
      )
        ? "limit must be an integer between 1 and 100"
        : undefined;
      throw new HTTPException(400, { message });
    }
  },
);

// tasks.id は uuid 型。UUID でない値のまま問い合わせると、DB の型エラーで 500 になる。
// UUID の形でない ID が指すタスクはないので、400 ではなく見つからないとして扱う
const taskParamValidator = zValidator(
  "param",
  z.object({ taskId: z.uuid() }),
  (result) => {
    if (!result.success) {
      throw new HTTPException(404);
    }
  },
);

// projects のルートから /projects/:projectId/tasks につなぐ。ログインの確認は projects 側の requireAuth が行う。
// tasks の操作はどれもメンバーなら行えるので、ルートごとではなく先頭でまとめて requireMember を掛ける
export const tasks = new Hono()
  .use(requireMember)
  .post("/", validator("json", createTaskSchema), async (c) => {
    const task = await createTask(c.get("projectId"), c.req.valid("json"));
    return c.json(task, 201);
  })
  .get("/", listTasksQueryValidator, async (c) => {
    const page = await listTasks(c.get("projectId"), c.req.valid("query"));
    return c.json(page, 200);
  })
  .get("/:taskId", taskParamValidator, async (c) => {
    const task = await findTask(
      c.get("projectId"),
      c.req.valid("param").taskId,
    );
    return c.json(task, 200);
  })
  .patch(
    "/:taskId",
    taskParamValidator,
    validator("json", updateTaskSchema),
    async (c) => {
      const task = await updateTask(
        c.get("projectId"),
        c.req.valid("param").taskId,
        c.req.valid("json"),
      );
      return c.json(task, 200);
    },
  )
  .delete("/:taskId", taskParamValidator, async (c) => {
    await deleteTask(c.get("projectId"), c.req.valid("param").taskId);
    return c.body(null, 204);
  })
  .route("/:taskId/comments", comments);
