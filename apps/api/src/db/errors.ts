import postgres from "postgres";

// Drizzle は DB のエラーを cause に包んで投げる。23505 は PostgreSQL の unique_violation
export const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  error.cause instanceof postgres.PostgresError &&
  error.cause.code === "23505";

// 23503 は PostgreSQL の foreign_key_violation。参照先の行がない（消えた）ときに起きる
export const isForeignKeyViolation = (error: unknown) =>
  error instanceof Error &&
  error.cause instanceof postgres.PostgresError &&
  error.cause.code === "23503";
