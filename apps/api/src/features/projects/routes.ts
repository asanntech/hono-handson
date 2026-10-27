import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.ts";
import { validator } from "../../middleware/validator.ts";
import { createProject } from "./service.ts";

const projectSchema = z.object({
  name: z.string(),
});

export const projects = new Hono().post(
  "/",
  requireAuth,
  validator("json", projectSchema),
  async (c) => {
    const project = await createProject({
      name: c.req.valid("json").name,
      userId: c.get("userId"),
    });
    return c.json(project, 201);
  },
);
