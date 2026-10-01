import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./build-app.js";
import { env } from "./env.js";
import { prisma } from "./lib/prisma.js";

const app = buildApp({
  logger: {
    level: env.LOG_LEVEL,
    // Extend with any sensitive body paths, e.g. "req.body.password".
    redact: ["req.headers.authorization", "req.headers.cookie"],
  },
});

async function start() {
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Long-running hosts listen; serverless (Vercel) uses the default export instead.
if (!process.env.VERCEL && env.NODE_ENV !== "test") {
  start();
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  await app.ready();
  app.server.emit("request", req, res);
}

export { app };
