import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";

// 検証に失敗したら、zValidator 既定の Zod のエラー形式ではなく、onError の統一形式で返す
export const validator = <
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType,
>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new HTTPException(400);
    }
  });
