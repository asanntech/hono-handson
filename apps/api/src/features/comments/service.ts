import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../../db/client.ts";
import { comments } from "../../db/schema.ts";

// API が返すコメントの項目。taskId はパスで分かっているので含めない
const commentColumns = {
  id: comments.id,
  body: comments.body,
  authorId: comments.authorId,
  createdAt: comments.createdAt,
};

export const createComment = async (
  taskId: string,
  authorId: string,
  input: { body: string },
) => {
  const [comment] = await db
    .insert(comments)
    .values({ taskId, authorId, ...input })
    .returning(commentColumns);
  return comment;
};

export const listComments = async (taskId: string) =>
  db
    .select(commentColumns)
    .from(comments)
    .where(eq(comments.taskId, taskId))
    // 作成日時が同じコメントの順番も決まるよう、id を 2 つ目の並び順にする
    .orderBy(asc(comments.createdAt), asc(comments.id));

// コメントの編集・削除は、書いた本人だけができる。
// 判定にはコメントを読む必要があり、パスだけで決まる requireMember / requireOwner と違ってミドルウェアにはしない。
// メンバーにはコメントが見えているので、本人でないメンバーには隠さずに 403 で権限がないことを伝える
const assertAuthor = async (id: string, userId: string) => {
  const [comment] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(eq(comments.id, id));
  if (comment?.authorId !== userId) {
    throw new HTTPException(403);
  }
};

export const updateComment = async (
  id: string,
  userId: string,
  input: { body: string },
) => {
  await assertAuthor(id, userId);
  const [comment] = await db
    .update(comments)
    .set(input)
    .where(eq(comments.id, id))
    .returning(commentColumns);
  return comment;
};

export const deleteComment = async (id: string, userId: string) => {
  await assertAuthor(id, userId);
  await db.delete(comments).where(eq(comments.id, id));
};
