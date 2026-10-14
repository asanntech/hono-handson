import { Hono } from "hono";
import { health } from "./features/health/routes.ts";

export const app = new Hono().route("/health", health);

export type AppType = typeof app;
