import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const parseEnv = (source: Record<string, string | undefined>) =>
  envSchema.parse(source);

export const env = parseEnv(process.env);
