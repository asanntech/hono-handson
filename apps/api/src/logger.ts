import { pino } from "pino";
import { env } from "./env.ts";

export const logger = pino({ level: env.LOG_MIN_LEVEL });
