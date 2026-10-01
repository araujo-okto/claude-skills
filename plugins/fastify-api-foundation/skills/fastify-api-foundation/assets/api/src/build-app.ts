import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { env } from "./env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { itemRoutes } from "./modules/items/item.routes.js";
import { errorHandler } from "./shared/error-handler.js";

const normalizeOrigin = (origin: string) =>
  origin.toLowerCase().replace(/\/+$/, "");

// Exact matches, or "*" wildcards (e.g. https://*-team.vercel.app).
const originMatchers = env.CORS_ORIGIN.map((allowed) => {
  const normalized = normalizeOrigin(allowed);
  if (!normalized.includes("*")) {
    return (origin: string) => origin === normalized;
  }
  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
  return (origin: string) => pattern.test(origin);
});

// Builds and configures the app. Never listens — tests and serverless reuse it.
export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, ...options });

  app.register(fastifyCors, {
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: (origin, cb) => {
      // No Origin header (curl, server-to-server): allowed only outside production.
      if (!origin) {
        cb(null, env.NODE_ENV !== "production");
        return;
      }
      const normalized = normalizeOrigin(origin);
      if (originMatchers.some((matches) => matches(normalized))) {
        cb(null, true);
        return;
      }
      // Refuse without throwing — an error here turns the preflight into a 500.
      app.log.warn({ origin }, "CORS origin not allowed");
      cb(null, false);
    },
  });

  app.register(fastifyCookie);
  app.setErrorHandler(errorHandler);

  app.register(healthRoutes, { prefix: "/health" });
  app.register(healthRoutes, { prefix: "/api/v1/health" });

  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(itemRoutes, { prefix: "/api/v1/items" });

  return app;
}
