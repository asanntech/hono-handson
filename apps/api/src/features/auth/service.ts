import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { sign } from "hono/jwt";
import postgres from "postgres";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema.ts";
import { env } from "../../env.ts";

// bcrypt のコスト。1 増やすとハッシュ化にかかる時間が倍になる
const SALT_ROUNDS = 10;

// JWT と Cookie の有効期限（秒）。両方をそろえ、Cookie だけ残って中の JWT が期限切れ、という状態を避ける
export const TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export const signup = async (input: { email: string; password: string }) => {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  try {
    const [user] = await db
      .insert(users)
      .values({ email: input.email, passwordHash })
      .returning({ id: users.id, email: users.email });
    return user;
  } catch (error) {
    // 事前に SELECT で確かめるのではなく、DB の一意制約で判定する。同時に登録されても重複を防げる
    if (isUniqueViolation(error)) {
      throw new HTTPException(409, { message: "Email is already registered" });
    }
    throw error;
  }
};

// Drizzle は DB のエラーを cause に包んで投げる。23505 は PostgreSQL の unique_violation
const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  error.cause instanceof postgres.PostgresError &&
  error.cause.code === "23505";

export const login = async (input: { email: string; password: string }) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email));
  // 未登録とパスワード違いで同じ例外を投げ、どちらが原因かを区別させない
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }
  return { id: user.id, email: user.email };
};

export const issueToken = (userId: string) =>
  sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE },
    env.JWT_SECRET,
    "HS256",
  );
