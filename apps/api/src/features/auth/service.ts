import bcrypt from "bcryptjs";
import { db } from "../../db/client.ts";
import { users } from "../../db/schema.ts";

// bcrypt のコスト。1 増やすとハッシュ化にかかる時間が倍になる
const SALT_ROUNDS = 10;

export const signup = async (input: { email: string; password: string }) => {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, passwordHash })
    .returning({ id: users.id, email: users.email });
  return user;
};
