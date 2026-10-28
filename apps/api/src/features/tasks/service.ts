import { db } from "../../db/client.ts";
import { tasks } from "../../db/schema.ts";

export const createTask = async (
  projectId: string,
  input: Pick<typeof tasks.$inferInsert, "title" | "description" | "status">,
) => {
  const [task] = await db
    .insert(tasks)
    .values({ projectId, ...input })
    .returning({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      createdAt: tasks.createdAt,
    });
  return task;
};
