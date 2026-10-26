import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.ts";

// アプリ全体で 1 つの接続プールを共有する。接続先は DATABASE_URL で切り替える
export const db = drizzle(postgres(env.DATABASE_URL));
