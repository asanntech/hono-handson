"use strict";

// New Relic エージェントの設定。エージェントは CommonJS で読み込むため、拡張子を .cjs にする。
// dev スクリプトの NEW_RELIC_HOME でこのフォルダを指す。テストでは読み込まず、vitest.config.ts の環境変数で無効にする。
// 同じ項目を環境変数（NEW_RELIC_*）でも指定すると、環境変数が優先される
exports.config = {
  app_name: ["hono-handson"],
  // ライセンスキーは秘密情報のため、ここには書かずに .env の NEW_RELIC_LICENSE_KEY で渡す。
  // エージェントを起動するかどうかも、キーの有無に合わせて .env の NEW_RELIC_ENABLED で切り替える
  error_collector: {
    // 4xx はクライアントの誤りで想定内のため、エラーとして記録しない（既定では 404 以外の 4xx を記録する）
    ignore_status_codes: ["400-499"],
  },
  application_logging: {
    // pino のログを New Relic に転送し、トレースと紐付ける（Logs in context）。既定でも有効だが、使っていることを明示する
    forwarding: { enabled: true },
  },
  logging: {
    // エージェント自身のログ（newrelic_agent.log）のレベル。アプリのログの LOG_MIN_LEVEL とは別
    level: "info",
  },
};
