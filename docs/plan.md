# Hono ハンズオン計画

Hono を使い、実務で必要なバックエンド開発の知識を、TDD による AI 駆動開発で学ぶための計画。

## 前提

- 受講者: 自分ひとり（学習用）
- 前提スキル: TypeScript が書け、REST API の基礎を理解している
- 進め方: `/tdd` スキルを使い、Red → Green → Refactor のサイクルで開発する
  - **自分**: テストリストと設計方針の承認、各サイクルのレビュー、各章の「理解確認の問い」に答える
  - **AI**: テストと実装を書く

## 技術スタック

| 領域 | 採用 | 理由 |
| --- | --- | --- |
| ランタイム | Node.js（`@hono/node-server`） | 実務で多い構成。Docker や PostgreSQL と組み合わせやすい |
| 題材 | チーム向けタスク管理API | 認証、認可、リレーション、ページネーションなど、実務で頻出の論点を網羅できる |
| フロントエンド | Vite + React の簡易SPA、Hono RPC（`hc`） | 型共有による RPC の利点を体験する。主役は API |
| DB / ORM | PostgreSQL（Docker Compose）+ Drizzle | 型安全で SQL に近く書ける。drizzle-kit でマイグレーションを管理する |
| 認証 | 自前実装（JWT を HttpOnly Cookie に入れる） | `hono/jwt`、`hono/cookie`、`hono/csrf` を使って、認証の仕組みを自分で理解する |
| バリデーション | `@hono/zod-validator` のみ | シンプルに保つ。API の仕様は RPC の型とテストで保証する（OpenAPI は扱わない） |
| テスト | Vitest + 本物の PostgreSQL での結合テスト | `app.request()` や `testClient` を使い、HTTP 層から実際の振る舞いを保証する |
| 構成 | 機能別ルート + サービス関数 | Hono 公式のベストプラクティスに沿い、Controller を作らず型推論を活かす |
| ツール | pnpm workspaces + Biome、実行は tsx の watch モード | 設定を少なく保ち、Hono 以外の設定作業を減らす |
| デプロイ | ローカルのみ | Docker Compose とローカルの Node.js で完結させる（CI と本番デプロイは扱わない） |

## ドメイン

- **User**: メールアドレスとパスワードで登録・ログインする
- **Project**: 作成者が owner になる
- **ProjectMember**: Project と User を結び、role（`owner` / `member`）を持つ
- **Task**: Project に属する。title、description、status（`todo` / `in_progress` / `done`）を持つ
- **Comment**: Task に属する

### 認可ルール

- Project とその配下のリソースは、メンバーだけが閲覧・操作できる
- Project の更新・削除と、メンバーの招待・削除は owner だけができる
- コメントの編集・削除は、そのコメントを書いた本人だけができる
- メンバーでないユーザーには `404` を返し、リソースが存在するかどうかを漏らさない

### 一覧API

- カーソル方式のページネーション（`createdAt` と `id` を組み合わせたカーソルを使う）
- `status` などで絞り込める
- クエリパラメータは Zod で型変換・検証する

## ディレクトリ構成（予定）

```
apps/
  api/
    src/
      app.ts            # Hono アプリの組み立て（export type AppType）
      index.ts          # @hono/node-server で起動
      env.ts            # 環境変数の検証と型付け
      db/               # Drizzle のスキーマ、クライアント、マイグレーション
      middleware/       # 認証、認可、ロギングなど
      features/
        auth/           # routes.ts / service.ts / *.test.ts
        projects/
        tasks/
        comments/
  web/                  # Vite + React（第10章で作る）
docker-compose.yml
```

## 章立て

各章では `/tdd` でテストリストを作って承認してから、サイクルを回す。テストがすべて通り、「理解確認の問い」に自分の言葉で答えられたら、その章は完了とする。

### 0. 環境構築

- 作るもの: pnpm モノレポ、Biome、Docker Compose（開発用DBとテスト用DB）、Vitest、tsx、`CLAUDE.md` のコマンド欄
- 完了条件: `pnpm test` が空の状態で通り、DB が起動する
- 理解確認: 開発用とテスト用で DB を分けるのはなぜか？

### 1. Hono の基礎

- 学ぶこと: ルーティング、パスパラメータ、`c.json` / `c.text`、`app.route()` によるルートの分割、`app.request()` を使ったテスト
- 作るもの: `GET /health`
- 理解確認: ハンドラを別ファイルの Controller に切り出すと、型推論はどう失われるか？

### 2. エラーハンドリングと設定

- 学ぶこと: `HTTPException`、`app.onError`、`app.notFound`、統一エラーレスポンスの形式、環境変数の Zod による検証
- 理解確認: 想定外の例外の詳細を、クライアントに返してはいけないのはなぜか？

### 3. DB

- 学ぶこと: Drizzle のスキーマ定義、drizzle-kit によるマイグレーション、テストごとの DB 初期化、DB クライアントをどこで生成し、どう注入するか
- 理解確認: テスト間でデータが漏れるとどんな問題が起きるか？ 今回はどうやって防いだか？

### 4. 認証

- 学ぶこと: パスワードのハッシュ化、signup / login / logout、`hono/jwt` の sign と verify、`hono/cookie` で HttpOnly・Secure・SameSite 属性を付けた Cookie、`createMiddleware` と `Variables` の型、`c.set` / `c.get`
- 理解確認: JWT を localStorage ではなく HttpOnly Cookie に入れる利点と、その代わりに必要になる対策は何か？

### 5. プロジェクトと認可

- 学ぶこと: 認可ミドルウェア（メンバーかどうか、owner かどうかの判定）、ミドルウェアの適用範囲、`404` と `403` の使い分け
- 作るもの: Project の CRUD、メンバーの招待と削除
- 理解確認: 認可をミドルウェアで行う場合とサービス関数で行う場合の、それぞれの利点と欠点は？

### 6. タスク

- 学ぶこと: ネストしたルート（`/projects/:projectId/tasks`）、クエリパラメータの検証（`zValidator('query', ...)`）、カーソル方式のページネーション、絞り込み
- 理解確認: オフセット方式と比べて、カーソル方式が優れている点と劣っている点は？

### 7. コメント

- 学ぶこと: 第4〜6章の復習（本人だけが操作できるという認可、ネストしたルート）
- 理解確認: 第5章とは異なる「本人のみ」という認可は、どこに置くのが自然か？

### 8. セキュリティ

- 学ぶこと: `secureHeaders`、`cors`、`csrf`、`bodyLimit`、ログイン API へのレート制限（`hono-rate-limiter` などを使う）
- 理解確認: Cookie 認証で CSRF 対策が必要なのはなぜか？ SameSite 属性だけでは足りないケースは？

### 9. ロギング

- 学ぶこと: `requestId` ミドルウェア、pino による構造化ログ、アクセスログ、エラーログとリクエストIDの紐付け
- 理解確認: 障害調査のとき、リクエストIDは何の役に立つか？

### 10. RPC と SPA

- 学ぶこと: `AppType` の公開、`hc` クライアント、ルートをメソッドチェーンでつなぐ必要性、`InferResponseType`、Vite のプロキシを使った同一オリジンでの Cookie 認証
- 作るもの: ログイン、プロジェクト一覧、タスク一覧（無限スクロール）の画面
- 理解確認: RPC で型が伝わる仕組みと、OpenAPI でスキーマを共有する方法との違いは？

## 対象外

- OpenAPI と Swagger UI
- CI と本番デプロイ
- ファイルアップロード、リアルタイム通知（SSE / WebSocket）
- ラベル、担当者、マルチテナント
