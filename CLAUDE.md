# hono-handson

Hono の学習用ハンズオン。チーム向けタスク管理API を TDD（`/tdd`）による AI 駆動開発で作る。計画の詳細は `docs/plan.md` を参照すること。

## 進め方

- 学習が目的。ユーザーは設計とレビューを担当し、AI はテストと実装を担当する
- 各章の開始時に `/tdd` でテストリストを作り、ユーザーの承認を得てから実装する
- 実装したコードで使った Hono の機能は、なぜそう書くのかが分かるように、レビューのときに簡潔に説明する
- `docs/plan.md` の章の範囲を超える機能は、先回りして実装しない

## 技術スタック

- Node.js + Hono（`@hono/node-server`）、TypeScript
- PostgreSQL（Docker Compose）+ Drizzle ORM / drizzle-kit
- `@hono/zod-validator` + Zod
- Vitest（本物の PostgreSQL を使った結合テスト）
- pnpm workspaces（`apps/api`、`apps/web`）、Biome、tsx
- フロントエンド: Vite + React、Hono RPC（`hc`）

## 設計方針

- 機能別ルート（`features/<name>/routes.ts`）+ サービス関数（`service.ts`）
- ハンドラはインラインで書き、Rails のような Controller は作らない（型推論を保つため）
- RPC で型を伝えるため、ルートはメソッドチェーンで定義し、`AppType` を export する
- エラーは `HTTPException` で投げ、`app.onError` で統一したエラーレスポンスに変換する
- 認証は JWT を HttpOnly Cookie に入れる方式で行う。認可はミドルウェアで行う
- メンバーでないユーザーには `404` を返す

## コマンド

<!-- 第0章（環境構築）で確定させてから記入する -->

- 依存関係のインストール: `pnpm install`
- DB の起動: `pnpm db:up`（停止は `pnpm db:down`）
- マイグレーション: TBD
- テスト（全件）: `pnpm test`
- テスト（ファイル指定）: `pnpm --filter @hono-handson/api test <ファイルパス>`
- Lint / Format: `pnpm lint`（チェックのみ） / `pnpm format`（自動修正）
- 型チェック: `pnpm typecheck`
- 開発サーバー: `pnpm dev`（http://localhost:3000）
