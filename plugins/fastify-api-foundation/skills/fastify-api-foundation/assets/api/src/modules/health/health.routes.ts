import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/live", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return reply.status(200).send({ status: "ok" });
  });

  app.get("/ready", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");

    try {
      await Promise.race([
        prisma.$queryRawUnsafe("SELECT 1"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database timeout")), 3000),
        ),
      ]);

      return reply.status(200).send({ status: "ready" });
    } catch {
      return reply.status(503).send({ status: "unavailable" });
    }
  });
}
