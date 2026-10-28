import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { tasks } from "../../db/schema.ts";

// API が返すタスクの項目。projectId はパスで分かっているので含めない
const taskColumns = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  createdAt: tasks.createdAt,
};

export const createTask = async (
  projectId: string,
  input: Pick<typeof tasks.$inferInsert, "title" | "description" | "status">,
) => {
  const [task] = await db
    .insert(tasks)
    .values({ projectId, ...input })
    .returning(taskColumns);
  return task;
};

export const listTasks = async (projectId: string) => {
  const items = await db
    .select(taskColumns)
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    // 作成日時が同じタスクの順番も決まるよう、id を 2 つ目の並び順にする
    .orderBy(desc(tasks.createdAt), desc(tasks.id));
  return { items, nextCursor: null };
};
