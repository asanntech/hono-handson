# hono-handson

## セットアップ

```sh
pnpm install
cp .env.example .env  # 開発用 DB とテスト用 DB の接続先
pnpm db:up            # PostgreSQL（開発用とテスト用）を起動する
pnpm db:migrate       # 開発用 DB にマイグレーションを適用する
```

テスト用 DB には、`pnpm test` の実行時に自動でマイグレーションを適用する。

## DB のスキーマを変更する

1. `apps/api/src/db/schema.ts` を編集する
2. `pnpm db:generate --name <変更内容>` でマイグレーションの SQL を生成し、コミットする
3. `pnpm db:migrate` で開発用 DB に適用する
