import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { AuthService } from "../modules/auth/auth.service.js";
import type { AuthUser, SessionWithUser } from "../modules/auth/auth.types.js";
import { UnauthorizedError } from "../shared/errors.js";

// __Host- forces Secure + Path=/ + no Domain; it needs HTTPS, so dev uses a plain name.
export const SESSION_COOKIE_NAME =
  env.NODE_ENV === "production" ? "__Host-session" : "session";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    session?: SessionWithUser;
  }
}

const authService = new AuthService();

// Use as a route preHandler: { preHandler: [authenticate] }
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) {
    throw new UnauthorizedError("Session not provided.");
  }

  const session = await authService.validateSession(token);
  request.user = session.user;
  request.session = session;
}

// Narrows `request.user` in controllers that sit behind `authenticate`.
export function requireUser(request: FastifyRequest): AuthUser {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}
