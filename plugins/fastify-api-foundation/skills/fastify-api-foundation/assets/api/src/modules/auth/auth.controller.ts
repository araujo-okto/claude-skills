import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../env.js";
import { SESSION_COOKIE_NAME } from "../../plugins/auth.plugin.js";
import { loginSchema } from "./auth.schemas.js";
import { AuthService, SESSION_TTL_MS } from "./auth.service.js";

const authService = new AuthService();

// set and clear MUST use the same attributes, or the browser keeps the cookie.
const isCrossSite = env.COOKIE_SAME_SITE === "none";
const cookieOptions: CookieSerializeOptions = {
  path: "/",
  httpOnly: true,
  secure: env.NODE_ENV === "production" || isCrossSite,
  sameSite: env.COOKIE_SAME_SITE,
  partitioned: isCrossSite,
};

export async function loginController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const input = loginSchema.parse(request.body);

  const { token, user } = await authService.login(input, {
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
  });

  reply.setCookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: SESSION_TTL_MS / 1000,
  });

  return reply.status(200).send({ user });
}

export async function logoutController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (request.session?.id) {
    await authService.logout(request.session.id);
  }

  reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
  return reply.status(204).send();
}

export async function meController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  return reply.status(200).send({ user: request.user });
}
