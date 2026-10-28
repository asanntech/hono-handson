import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  JWT_SECRET: z.string().min(32),
  // ブラウザが送る Origin ヘッダーと文字列で比べるため、パスや末尾のスラッシュを含まないオリジンの形に限る
  WEB_ORIGIN: z
    .url({ protocol: /^https?$/ })
    .refine((url) => url === new URL(url).origin)
    .default("http://localhost:5173"),
});

export const parseEnv = (source: Record<string, string | undefined>) =>
  envSchema.parse(source);

export const env = parseEnv(process.env);
