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
