import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectRole = pgEnum("project_role", ["owner", "member"]);

// 同じユーザーを同じプロジェクトに 2 回登録できないよう、(projectId, userId) の組を主キーにする
export const projectMembers = pgTable(
  "project_members",
  {
    // プロジェクトを消したら、そのメンバー情報も DB が一緒に消す
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: projectRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

export const taskStatus = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // プロジェクトを消したら、そのタスクも DB が一緒に消す
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatus("status").notNull().default("todo"),
    // 一覧のカーソルに入れる値。JS の Date はミリ秒までしか持てないため、DB もミリ秒にそろえる。
    // 既定のマイクロ秒のままだと、カーソルにした時点で切り捨てられ、ページの境目のタスクが欠ける
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // 一覧の絞り込み（projectId）と並び順（createdAt, id の降順）に合わせる。
    // カーソルの位置まで索引をたどり、そこから limit 件だけ読める。プロジェクト削除の cascade でも使われる。
    // Drizzle の desc() は索引では NULLS LAST になるが、ORDER BY ... DESC は NULLS FIRST。
    // 向きがずれると PostgreSQL は索引の順番を使えず並べ替え直すため、nullsFirst() でそろえる
    index("tasks_project_id_created_at_id_idx").on(
      table.projectId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // 一覧の絞り込み（taskId）と並び順（createdAt, id の昇順）に合わせ、並べ替えずに索引の順で読めるようにする。
    // PostgreSQL は外部キーに索引を自動で張らないため、これがないとタスクのコメントを探すたびにテーブル全体を読む。
    // 昇順は ORDER BY ... ASC も索引も NULLS LAST が既定で、向きがそろっているため nullsFirst() は要らない
    index("comments_task_id_created_at_id_idx").on(
      table.taskId,
      table.createdAt,
      table.id,
    ),
  ],
);
