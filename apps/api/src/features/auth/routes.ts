import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { signup } from "./service.ts";

const credentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
});

export const auth = new Hono().post(
  "/signup",
  zValidator("json", credentialsSchema),
  async (c) => {
    const user = await signup(c.req.valid("json"));
    return c.json(user, 201);
  },
);
