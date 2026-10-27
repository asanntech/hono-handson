import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { projectMembers, projects, users } from "../../db/schema.ts";

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

export const listProjects = (userId: string) =>
  db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));

export const findProject = async (id: string) => {
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, id));
  return project;
};

export const findMemberRole = async (projectId: string, userId: string) => {
  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    );
  return member?.role;
};

export const listMembers = (projectId: string) =>
  db
    .select({
      userId: projectMembers.userId,
      email: users.email,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(projectMembers.createdAt));

export const updateProject = async (id: string, input: { name: string }) => {
  const [project] = await db
    .update(projects)
    .set({ name: input.name })
    .where(eq(projects.id, id))
    .returning({ id: projects.id, name: projects.name });
  return project;
};
