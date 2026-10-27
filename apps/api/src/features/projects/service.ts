import { db } from "../../db/client.ts";
import { projectMembers, projects } from "../../db/schema.ts";

export const createProject = (input: { name: string; userId: string }) =>
  // プロジェクトだけ作られて owner がいない状態を残さないよう、2 つの INSERT を 1 つのトランザクションにまとめる
  db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ name: input.name })
      .returning({ id: projects.id, name: projects.name });
    await tx
      .insert(projectMembers)
      .values({ projectId: project.id, userId: input.userId, role: "owner" });
    return project;
  });
