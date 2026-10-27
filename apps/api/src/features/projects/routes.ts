import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.ts";
import { validator } from "../../middleware/validator.ts";
import { createProject } from "./service.ts";

const projectSchema = z.object({
  name: z.string().min(1).max(100),
});

// /projects 配下はすべてログインが必要。ルートごとに付けると、新しいルートで付け忘れるおそれがある。
// ルートが存在しないパスにも効くため、未ログインのユーザーにはどのパスがあるかも伝わらない
export const projects = new Hono()
  .use(requireAuth)
  .post("/", validator("json", projectSchema), async (c) => {
    const project = await createProject({
      name: c.req.valid("json").name,
      userId: c.get("userId"),
    });
    return c.json(project, 201);
  });
