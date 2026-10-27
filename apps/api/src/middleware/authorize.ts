import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { findMemberRole } from "../features/projects/service.ts";
import type { AuthVariables } from "./auth.ts";

// requireAuth の後に置き、パスの :projectId のメンバーでなければ 404 にする。
// プロジェクトが存在しない場合とメンバーでない場合を区別せず、存在するかどうかを漏らさない
export const requireMember = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // projects.id は uuid 型。UUID でない値のまま問い合わせると、DB の型エラーで 500 になる。
    // ミドルウェアはどのパスに付けられるか分からず param の型は string | undefined なので、undefined もここで弾く
    const projectId = z.uuid().safeParse(c.req.param("projectId"));
    if (!projectId.success) {
      throw new HTTPException(404);
    }
    const role = await findMemberRole(projectId.data, c.get("userId"));
    if (!role) {
      throw new HTTPException(404);
    }
    await next();
  },
);
