import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.ts";
import { requireMember, requireOwner } from "../../middleware/authorize.ts";
import { validator } from "../../middleware/validator.ts";
import {
  addMember,
  createProject,
  deleteProject,
  findProject,
  listMembers,
  listProjects,
  updateProject,
} from "./service.ts";

const projectSchema = z.object({
  // trim を先に置くと、空白を落とした後の文字数で min / max を判定する。空白だけの name は空文字になり弾かれる
  name: z.string().trim().min(1).max(100),
});

const memberSchema = z.object({
  email: z.email(),
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
  })
  .get("/", async (c) => {
    const myProjects = await listProjects(c.get("userId"));
    return c.json(myProjects, 200);
  })
  .get("/:projectId", requireMember, async (c) => {
    const project = await findProject(c.req.param("projectId"));
    return c.json(project, 200);
  })
  .patch(
    "/:projectId",
    requireMember,
    requireOwner,
    validator("json", projectSchema),
    async (c) => {
      const project = await updateProject(
        c.req.param("projectId"),
        c.req.valid("json"),
      );
      return c.json(project, 200);
    },
  )
  .delete("/:projectId", requireMember, requireOwner, async (c) => {
    await deleteProject(c.req.param("projectId"));
    return c.body(null, 204);
  })
  .get("/:projectId/members", requireMember, async (c) => {
    const members = await listMembers(c.req.param("projectId"));
    return c.json(members, 200);
  })
  .post(
    "/:projectId/members",
    requireMember,
    requireOwner,
    validator("json", memberSchema),
    async (c) => {
      const member = await addMember(
        c.req.param("projectId"),
        c.req.valid("json").email,
      );
      return c.json(member, 201);
    },
  );
