import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { type taskStatus, tasks } from "../../db/schema.ts";

// API が返すタスクの項目。projectId はパスで分かっているので含めない
const taskColumns = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  createdAt: tasks.createdAt,
};

// カーソルは、前のページの最後のタスクの { createdAt, id }。
// クライアントには中身を意識させないよう、JSON を base64url で包んだ文字列にする
type Cursor = { createdAt: Date; id: string };

const encodeCursor = (cursor: Cursor) =>
  Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString("base64url");

const decodeCursor = (value: string): Cursor => {
  const { createdAt, id } = JSON.parse(
    Buffer.from(value, "base64url").toString(),
  );
  return { createdAt: new Date(createdAt), id };
};

// クライアントが作成・更新で指定できる項目
type TaskInput = Pick<
  typeof tasks.$inferInsert,
  "title" | "description" | "status"
>;

export const createTask = async (projectId: string, input: TaskInput) => {
  const [task] = await db
    .insert(tasks)
    .values({ projectId, ...input })
    .returning(taskColumns);
  return task;
};

export const listTasks = async (
  projectId: string,
  query: {
    limit: number;
    cursor?: string;
    status?: (typeof taskStatus.enumValues)[number];
  },
) => {
  const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
  const rows = await db
    .select(taskColumns)
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        query.status && eq(tasks.status, query.status),
        // 並び順（createdAt の降順、同じなら id の降順）で、カーソルより後ろにあるタスクだけを取る
        cursor &&
          or(
            lt(tasks.createdAt, cursor.createdAt),
            and(eq(tasks.createdAt, cursor.createdAt), lt(tasks.id, cursor.id)),
          ),
      ),
    )
    // 作成日時が同じタスクの順番も決まるよう、id を 2 つ目の並び順にする
    .orderBy(desc(tasks.createdAt), desc(tasks.id))
    // 次のページがあるかを知るため、1 件多く取る
    .limit(query.limit + 1);
  if (rows.length <= query.limit) {
    return { items: rows, nextCursor: null };
  }
  const items = rows.slice(0, query.limit);
  return { items, nextCursor: encodeCursor(items[items.length - 1]) };
};

export const findTask = async (id: string) => {
  const [task] = await db
    .select(taskColumns)
    .from(tasks)
    .where(eq(tasks.id, id));
  return task;
};

export const updateTask = async (id: string, input: Partial<TaskInput>) => {
  const [task] = await db
    .update(tasks)
    .set(input)
    .where(eq(tasks.id, id))
    .returning(taskColumns);
  return task;
};
