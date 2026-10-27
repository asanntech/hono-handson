import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../../db/client.ts";
import { isUniqueViolation } from "../../db/errors.ts";
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

export const deleteProject = async (id: string) => {
  await db.delete(projects).where(eq(projects.id, id));
};

export const addMember = async (projectId: string, email: string) => {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email));
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }
  try {
    const [member] = await db
      .insert(projectMembers)
      .values({ projectId, userId: user.id, role: "member" })
      .returning({ userId: projectMembers.userId, role: projectMembers.role });
    return { userId: member.userId, email: user.email, role: member.role };
  } catch (error) {
    // signup と同じく、事前に SELECT で確かめるのではなく主キーの一意制約で判定する。同時に招待されても重複を防げる
    if (isUniqueViolation(error)) {
      throw new HTTPException(409, { message: "User is already a member" });
    }
    throw error;
  }
};

export const removeMember = async (projectId: string, userId: string) => {
  // owner がいなくなると、プロジェクトの更新・削除・招待を誰もできなくなる。
  // 消せるのは member だけ、という条件を DELETE に含める。DB が 1 つの SQL の中で判定するので、同時に role が変わっても owner は消えない
  const removed = await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.role, "member"),
      ),
    )
    .returning({ userId: projectMembers.userId });
  if (removed.length > 0) {
    return;
  }
  // 消えなかった理由は、DELETE の結果だけでは分からない。失敗したときだけ、改めて role を調べる
  if ((await findMemberRole(projectId, userId)) === "owner") {
    throw new HTTPException(409, { message: "Owner cannot be removed" });
  }
};
