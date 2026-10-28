// app.request の第 3 引数に渡す c.env。@hono/node-server は接続元の情報を c.env.incoming に入れ、
// login のレート制限は getConnInfo でそこから IP を読む。渡さないと getConnInfo が例外を投げて 500 になる
export const connectionFrom = (ip: string) => ({
  incoming: { socket: { remoteAddress: ip } },
});
