import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default("development"),
});

export const parseEnv = (source: Record<string, string | undefined>) =>
  envSchema.parse(source);
