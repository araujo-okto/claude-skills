import type { FastifyInstance } from "fastify";
import { authenticate } from "../../plugins/auth.plugin.js";
import {
  loginController,
  logoutController,
  meController,
} from "./auth.controller.js";

export async function authRoutes(app: FastifyInstance) {
  // Add @fastify/rate-limit config here for /login in production.
  app.post("/login", loginController);
  app.post("/logout", { preHandler: [authenticate] }, logoutController);
  app.get("/me", { preHandler: [authenticate] }, meController);
}
