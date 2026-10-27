import postgres from "postgres";

// Drizzle は DB のエラーを cause に包んで投げる。23505 は PostgreSQL の unique_violation
export const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  error.cause instanceof postgres.PostgresError &&
  error.cause.code === "23505";
