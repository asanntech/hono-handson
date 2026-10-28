import { and, asc, eq } from "drizzle-orm";
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

// パスの taskId でも絞り込む。別のタスクのコメント ID を指定されても、存在しない ID と同じ 404 にする
const byTaskAndId = (taskId: string, id: string) =>
  and(eq(comments.taskId, taskId), eq(comments.id, id));

// コメントの編集・削除は、書いた本人だけができる。
// 判定にはコメントを読む必要があり、パスだけで決まる requireMember / requireOwner と違ってミドルウェアにはしない。
// メンバーにはコメントが見えているので、本人でないメンバーには隠さずに 403 で権限がないことを伝える
const assertAuthor = async (taskId: string, id: string, userId: string) => {
  const [comment] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(byTaskAndId(taskId, id));
  if (!comment) {
    throw new HTTPException(404);
  }
  if (comment.authorId !== userId) {
    throw new HTTPException(403);
  }
};

// assertAuthor で確かめてから更新・削除するまでの間に、本人が別のリクエストでコメントを消すことがある。
// そのときは 0 件になるので、確かめた時点で存在しなかった場合と同じ 404 にする。
// authorId は作成後に変わらないため、間に本人かどうかが変わることはない
export const updateComment = async (
  taskId: string,
  id: string,
  userId: string,
  input: { body: string },
) => {
  await assertAuthor(taskId, id, userId);
  const [comment] = await db
    .update(comments)
    .set(input)
    .where(byTaskAndId(taskId, id))
    .returning(commentColumns);
  if (!comment) {
    throw new HTTPException(404);
  }
  return comment;
};

export const deleteComment = async (
  taskId: string,
  id: string,
  userId: string,
) => {
  await assertAuthor(taskId, id, userId);
  const deleted = await db
    .delete(comments)
    .where(byTaskAndId(taskId, id))
    .returning({ id: comments.id });
  if (deleted.length === 0) {
    throw new HTTPException(404);
  }
};
