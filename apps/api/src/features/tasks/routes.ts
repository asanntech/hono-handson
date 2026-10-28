import { Hono } from "hono";
import { z } from "zod";
import { taskStatus } from "../../db/schema.ts";
import { requireMember } from "../../middleware/authorize.ts";
import { validator } from "../../middleware/validator.ts";
import { createTask, findTask, listTasks } from "./service.ts";

const createTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(taskStatus.enumValues).optional(),
});

const listTasksQuerySchema = z.object({
  // クエリパラメータは文字列で届くため、coerce で数値に変換してから検証する
  limit: z.coerce.number().default(20),
  cursor: z.string().optional(),
  status: z.enum(taskStatus.enumValues).optional(),
});

// projects のルートから /projects/:projectId/tasks につなぐ。ログインの確認は projects 側の requireAuth が行う。
// tasks の操作はどれもメンバーなら行えるので、ルートごとではなく先頭でまとめて requireMember を掛ける
export const tasks = new Hono()
  .use(requireMember)
  .post("/", validator("json", createTaskSchema), async (c) => {
    const task = await createTask(c.get("projectId"), c.req.valid("json"));
    return c.json(task, 201);
  })
  .get("/", validator("query", listTasksQuerySchema), async (c) => {
    const page = await listTasks(c.get("projectId"), c.req.valid("query"));
    return c.json(page, 200);
  })
  .get("/:taskId", async (c) => {
    const task = await findTask(c.req.param("taskId"));
    return c.json(task, 200);
  });
