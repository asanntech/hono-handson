import type { AppType } from "@hono-handson/api/app";
import { hc } from "hono/client";

// AppType は型だけを読み込むため、API の実行時のコード（DB への接続など）はバンドルに入らない。
// /api は Vite のプロキシが API サーバーに転送する。テスト（jsdom）の fetch は相対 URL を解決できないため、オリジンを付ける
export const api = hc<AppType>(`${location.origin}/api`);
