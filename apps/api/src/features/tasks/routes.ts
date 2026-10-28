import { Hono } from "hono";
import { z } from "zod";
import { taskStatus } from "../../db/schema.ts";
import { requireMember } from "../../middleware/authorize.ts";
import { validator } from "../../middleware/validator.ts";
import { createTask } from "./service.ts";

const createTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(taskStatus.enumValues).optional(),
});

// projects のルートから /projects/:projectId/tasks につなぐ。ログインの確認は projects 側の requireAuth が行う。
// tasks の操作はどれもメンバーなら行えるので、ルートごとではなく先頭でまとめて requireMember を掛ける
export const tasks = new Hono()
  .use(requireMember)
  .post("/", validator("json", createTaskSchema), async (c) => {
    const task = await createTask(c.get("projectId"), c.req.valid("json"));
    return c.json(task, 201);
  });
