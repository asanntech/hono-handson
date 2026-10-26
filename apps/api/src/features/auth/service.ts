import bcrypt from "bcryptjs";
import { sign } from "hono/jwt";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema.ts";
import { env } from "../../env.ts";

// bcrypt のコスト。1 増やすとハッシュ化にかかる時間が倍になる
const SALT_ROUNDS = 10;

// JWT と Cookie の有効期限（秒）。両方をそろえ、Cookie だけ残って中の JWT が期限切れ、という状態を避ける
export const TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export const signup = async (input: { email: string; password: string }) => {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, passwordHash })
    .returning({ id: users.id, email: users.email });
  return user;
};

export const issueToken = (userId: string) =>
  sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE },
    env.JWT_SECRET,
    "HS256",
  );
