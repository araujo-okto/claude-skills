# Server & app composition

Templates: `assets/api/src/build-app.ts`, `assets/api/src/server.ts`, `assets/api/src/modules/health/health.routes.ts`, `assets/api/src/shared/error-handler.ts`.

## Why split `build-app.ts` and `server.ts`

| File | Does | Never does |
| --- | --- | --- |
| `build-app.ts` → `buildApp(options)` | Creates Fastify, registers plugins (CORS, cookie, …), the error handler and every route module with its prefix, then returns the instance | `listen()`, `process.exit`, signal handlers |
| `server.ts` | Builds the app with production logger options, listens, handles SIGINT/SIGTERM, exports a serverless `handler` | Route registration |

Tests call `buildApp({ logger: false })` and `app.inject(...)` with no port and no network. Serverless platforms import the default export.

## server.ts responsibilities

```ts
const app = buildApp({
  logger: { level: env.LOG_LEVEL, redact: ["req.headers.authorization", "req.headers.cookie"] },
});
```
- Pino `redact` keeps credentials out of logs. Extend the list with any sensitive body paths.
- `start()` runs only when `!process.env.VERCEL && NODE_ENV !== "test"`. On a failed listen it logs, disconnects Prisma, and exits 1.
- `shutdown()` runs `app.close()` → `prisma.$disconnect()` → `exit(0)` on SIGINT/SIGTERM.
- Serverless export:
  ```ts
  export default async function handler(req, res) { await app.ready(); app.server.emit("request", req, res); }
  ```
  (`process.env.VERCEL` / `NODE_ENV` reads here are platform flags. Moving them into `env.ts` is also fine.)

## Route registration and versioning

- Every business route lives under `/api/v1/<module>`: `app.register(itemRoutes, { prefix: "/api/v1/items" })`.
- Health is registered twice, at `/health` (platform probes) and `/api/v1/health` (through the web proxy).
- Each module exports `async function <name>Routes(app: FastifyInstance)`.

## CORS (credentials mode)

- `credentials: true` is required for cookies. The origin must be an explicit echo, never `*`.
- The origin callback normalizes values (lowercase, no trailing slash) and matches against `env.CORS_ORIGIN`, supporting `*` wildcards compiled to a regex.
- **No `Origin` header** (curl, server-to-server) is allowed in dev and refused in production.
- A disallowed origin is logged with `app.log.warn` and answered with `cb(null, false)`, **not** with an error. Throwing makes the preflight return a 500.
- List the methods explicitly: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.

## Health checks

- `GET /health/live` returns 200 `{status:"ok"}` with no dependencies. This tells the platform the process is alive.
- `GET /health/ready` runs `SELECT 1` raced against a 3s timeout, returning 200 `{status:"ready"}` or 503 `{status:"unavailable"}`. The deploy pipeline curls this endpoint.
- Both send `Cache-Control: no-store`.

## Global error handler

`app.setErrorHandler(errorHandler)` maps errors in this order:
1. `AppError` → `error.statusCode`, `{ error: { code, message } }`
2. `ZodError` → 400 `{ error: { code: "VALIDATION_ERROR", message, issues } }`, with issues from `z.flattenError(error).fieldErrors` (Zod 4; `error.flatten()` is deprecated)
3. Fastify errors with `statusCode < 500` (bad JSON, 415, 413) → pass through their status with a generic code. This keeps client mistakes out of the 500 bucket.
4. Anything else → `request.log.error(error)`, 500 `{ error: { code: "INTERNAL_SERVER_ERROR", message } }`. Never send the stack trace.

Reserve error tracking (Sentry) for case 4.
