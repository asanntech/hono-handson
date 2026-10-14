import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number(),
  NODE_ENV: z.string().optional(),
});

export const parseEnv = (source: Record<string, string | undefined>) =>
  envSchema.parse(source);
