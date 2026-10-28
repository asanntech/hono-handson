/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // src/routes のファイル構成から、型付きのルート定義（routeTree.gen.ts）を生成する。react より前に置く
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      // ルートのそばに置いたテストファイルを、ルートとして扱わない
      routeFileIgnorePattern: "\\.test\\.tsx?$",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // /api/* を API サーバーに転送する。ブラウザからは同じオリジンに見えるため、
    // SameSite=Strict の HttpOnly Cookie がそのまま送られ、CORS も要らない
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    passWithNoTests: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
