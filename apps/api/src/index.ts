import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
