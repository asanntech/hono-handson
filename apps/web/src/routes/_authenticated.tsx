import { createFileRoute, redirect } from "@tanstack/react-router";
import { api } from "@/lib/api";

// このレイアウトの下に置いたルートは、描画の前にログインしているかを確かめる。
// JWT は HttpOnly Cookie にあり JS から読めないため、API に問い合わせて判定する
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const res = await api.auth.me.$get();
    if (!res.ok) {
      throw redirect({ to: "/login" });
    }
  },
});
