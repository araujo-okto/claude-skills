import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError, z } from "zod";
import { AppError } from "./errors.js";

// Single place that turns errors into the `{ error: { code, message } }` contract.
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data.",
        issues: z.flattenError(error).fieldErrors,
      },
    });
  }

  // Fastify's own client errors (malformed JSON, 413, 415…) keep their status.
  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode && fastifyError.statusCode < 500) {
    return reply.status(fastifyError.statusCode).send({
      error: {
        code: fastifyError.code ?? "BAD_REQUEST",
        message: fastifyError.message,
      },
    });
  }

  // Unexpected: log server-side, never leak internals. (Report to Sentry here.)
  request.log.error(error);
  return reply.status(500).send({
    error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error." },
  });
}
