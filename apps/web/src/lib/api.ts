import type { AppType } from "@hono-handson/api/app";
import { hc } from "hono/client";

// AppType は型だけを読み込むため、API の実行時のコード（DB への接続など）はバンドルに入らない。
// /api は Vite のプロキシが API サーバーに転送する。テスト（jsdom）の fetch は相対 URL を解決できないため、オリジンを付ける
export const api = hc<AppType>(`${location.origin}/api`);

// app.onError が返す統一エラーの形。HTTPException で投げたエラーはハンドラの戻り値ではないため、
// RPC の型に現れない（!res.ok の分岐でも res.json() は成功時の型のまま）。そのため web 側で形を書く
type ApiErrorBody = { error: { message: string } };

export const readErrorMessage = async (res: { json(): Promise<unknown> }) =>
  ((await res.json()) as ApiErrorBody).error.message;
