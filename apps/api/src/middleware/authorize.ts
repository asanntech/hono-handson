import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { findMemberRole } from "../features/projects/service.ts";
import type { AuthVariables } from "./auth.ts";

// requireAuth の後に置き、パスの :projectId のメンバーでなければ 404 にする。
// プロジェクトが存在しない場合とメンバーでない場合を区別せず、存在するかどうかを漏らさない
export const requireMember = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // ミドルウェアはどのパスに付けられるか分からないため、param の型は string | undefined になる
    const projectId = c.req.param("projectId");
    if (!projectId) {
      throw new HTTPException(404);
    }
    const role = await findMemberRole(projectId, c.get("userId"));
    if (!role) {
      throw new HTTPException(404);
    }
    await next();
  },
);
