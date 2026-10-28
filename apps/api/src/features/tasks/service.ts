import { db } from "../../db/client.ts";
import { tasks } from "../../db/schema.ts";

export const createTask = async (
  projectId: string,
  input: { title: string },
) => {
  const [task] = await db
    .insert(tasks)
    .values({ projectId, title: input.title })
    .returning({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      createdAt: tasks.createdAt,
    });
  return task;
};
