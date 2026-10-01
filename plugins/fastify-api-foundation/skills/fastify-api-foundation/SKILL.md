---
name: fastify-api-foundation
description: Scaffold and extend a production-grade TypeScript backend foundation — npm-workspaces monorepo, Fastify 5 REST API, Prisma 7 (prisma-client generator + @prisma/adapter-pg) on PostgreSQL/Supabase, Zod 4 env and request validation, strict TypeScript ESM (NodeNext), Biome lint/format, Vitest with app.inject, Docker Compose Postgres, server-side cookie sessions with Argon2, GitHub Actions CI and Vercel deploy. Use this skill whenever the user wants to start a new Node/TypeScript API, set up or fix Prisma 7, an env.ts with Zod, a Fastify app/server split, a route→controller→service→repository module, a global error handler, Biome/tsconfig/Vitest config, or the CI/migration/deploy pipeline — even if they only say "set up the backend", "create the API skeleton", "add a new module", "same structure as my other project", or ask how the backend foundations are wired.
---

# Fastify API Foundation

A reusable backend foundation for a TypeScript API: what each piece is for, how they connect, and ready-to-copy templates. It isn't tied to any business domain. The example module is a neutral `items` resource that you rename.

## The stack and why each piece is there

| Concern | Choice | Reason |
| --- | --- | --- |
| Repo layout | npm workspaces (`apps/api`, `apps/web`) | One install and one lockfile. Root scripts delegate with `--workspace`. Add no `packages/shared` until real shared contracts exist. |
| Language | TypeScript `strict` + `noUncheckedIndexedAccess`, ESM, `module/moduleResolution: NodeNext` | Node's native ESM. Relative imports **must end in `.js`** even inside `.ts` files. |
| Runtime/dev | Node ≥ 20.19 (CI on 22), `tsx watch` for dev, `tsc` for build | tsx needs no build step in dev. tsc output in `dist/` is what `node dist/server.js` runs. |
| HTTP | Fastify 5 + `@fastify/cors` + `@fastify/cookie` | Plugin and hook model, `app.inject()` for tests without a port, Pino logger built in. |
| Validation | Zod 4 | Validates untrusted data at the boundaries: env, body/params/query, webhooks, external APIs. |
| ORM | Prisma 7, `prisma-client` generator, `@prisma/adapter-pg` + `pg` | Typed queries and migrations. Prisma 7 needs a driver adapter and a `prisma.config.ts`. |
| DB | PostgreSQL 17 (Docker locally, Supabase hosted) | Same engine everywhere. Hosted environments use the pooler for runtime and a direct URL for migrations. |
| Passwords / tokens | `@node-rs/argon2`; `crypto.randomBytes` + SHA-256 | Argon2id for passwords. Session tokens are random, and only their hash is stored. |
| Lint/format | Biome 2 (one `biome.json` at the root) | Replaces ESLint and Prettier with a single fast tool. |
| Tests | Vitest 4 (`*.spec.ts` next to the code) | Unit tests swap in in-memory repositories. HTTP tests run `buildApp()` + `inject` + `vi.spyOn` on repository prototypes. |
| CI/CD | GitHub Actions → `prisma migrate deploy` → Vercel prebuilt deploy | Validate first, migrate second, deploy last, then smoke-test `/health/ready`. |

## Target layout

```text
.
├── apps/
│   └── api/
│       ├── prisma/{schema.prisma, migrations/, seed.ts}
│       ├── prisma.config.ts
│       ├── src/
│       │   ├── server.ts          # entrypoint: listen, graceful shutdown, serverless handler
│       │   ├── build-app.ts       # builds the Fastify instance; never listens
│       │   ├── env.ts             # the ONLY place that reads process.env
│       │   ├── generated/prisma/  # Prisma client output (gitignored)
│       │   ├── lib/               # prisma.ts, password.ts, session-token.ts
│       │   ├── plugins/           # auth.plugin.ts (preHandler + request typing)
│       │   ├── shared/            # errors.ts, error-handler.ts
│       │   └── modules/<name>/    # <name>.routes|controller|service|repository|schemas|types|errors.ts (+ .spec.ts)
│       ├── .env.example
│       ├── package.json, tsconfig.json, tsconfig.build.json, vitest.config.ts, vercel.json
├── .github/workflows/{ci.yml, deploy.yml}
├── biome.json, docker-compose.yml, tsconfig.base.json, package.json, .gitignore
```

Create folders only when they hold files. Group code by **feature module**, not by database table. Keep cross-cutting helpers small, in `lib/`, `plugins/` and `shared/`.

## Request flow (the core rule)

```text
Route → Controller → Service → Repository → Prisma → PostgreSQL
```

- **Route** (`*.routes.ts`): method, URL, `preHandler: [authenticate]`, and later rate limits and OpenAPI. It holds no logic and never touches Prisma.
- **Controller** (`*.controller.ts`): the HTTP adapter. It runs `schema.parse()` on `request.body`, `params` and `query`, reads `request.user`, calls the service, and sets the status code. Parse errors are thrown, and the global handler turns them into a 400.
- **Service** (`*.service.ts`): business rules, authorization, uniqueness and conflict checks, transactions, and the shape of the safe output. It receives already-validated DTOs and doesn't parse them again. Its dependencies come in through the constructor with defaults: `constructor(private repo = new ItemRepository())`. Tests inject fakes the same way.
- **Repository** (`*.repository.ts`): the only layer that imports `prisma`. It knows nothing about HTTP or permissions. Methods take an optional `db: DbClient` so they can join a transaction.
- **Errors**: services throw `AppError` subclasses that carry `statusCode` and a stable `code`. One `setErrorHandler` maps everything to `{ error: { code, message, issues? } }`.

Read `references/layers.md` for the full patterns and code, including transactions, optimistic concurrency, safe outputs, and the type contracts (DTO, Entity, Summary).

## Typing contract in one sentence

> Zod validates untrusted data at runtime; TypeScript holds internal contracts; Prisma types and runs persistence; PostgreSQL enforces constraints.

Define a new type only when the data changes meaning (validated input, persistence data, entity, output projection). Infer DTOs from schemas with `z.infer`/`z.output`. Use `Pick`/`Partial<Pick<…>>` for allowed update fields. `Omit<User,"passwordHash">` changes only the type, so strip secrets at runtime with Prisma `select` or by building the output explicitly.

## Scaffolding a new project: ordered steps

Copy from `assets/` (paths mirror the target layout), rename the `items` example, then work through the steps below. The asset set as a whole passes `npm run check` (Biome, tsc, 7 Vitest tests, build, prisma validate) out of the box, so if something fails after copying, the cause is a local change.

```text
assets/root/    package.json, tsconfig.base.json, biome.json, docker-compose.yml, gitignore.txt (→ .gitignore)
assets/api/     package.json, tsconfig*.json, vitest.config.ts, prisma.config.ts, vercel.json, .env.example,
                prisma/{schema.prisma, seed.ts},
                src/{env, server, build-app}.ts, lib/, plugins/auth.plugin.ts, shared/,
                modules/{health, auth (login/logout/me), items (full example + 2 specs)}
assets/github/  ci.yml, deploy.yml  (→ .github/workflows/)
```

1. **Root**: `assets/root/*` → repo root. Rename `gitignore.txt` to `.gitignore`, and replace `my-project` / `app_db`. Keep Biome pinned (`"2.2"`): newer minors deprecate config keys, so upgrade deliberately with `npx biome migrate`.
2. **API package**: `assets/api/*` → `apps/api/`. Run `npm i` at the root. Dependencies: `fastify @fastify/cors @fastify/cookie zod @prisma/client @prisma/adapter-pg pg dotenv @node-rs/argon2`. Dev dependencies: `prisma tsx vitest @types/pg` (plus `typescript @types/node @biomejs/biome` at the root).
3. **Env**: copy `.env.example` → `apps/api/.env` (that file is what `dotenv/config` loads, relative to the cwd `apps/api`). Then `npm run db:up`.
4. **Prisma**: edit `schema.prisma`, run `npm run prisma:generate`, then `npm run prisma:migrate:dev -- --name init` (or `db:push` for throwaway prototyping). Run `db:seed` if needed.
5. **Run**: `npm run dev:api`, then `GET /health/live` and `/health/ready`.
6. **Gate**: `npm run check` (lint → typecheck → test → build → prisma validate). CI runs the same steps.

Details per topic, read as needed:
- `references/env-and-config.md`: env.ts design, the APP_ENV vs NODE_ENV split, DATABASE_URL vs DIRECT_URL, production guards, CORS parsing, cookie SameSite
- `references/prisma7.md`: generator, config file, adapter, client singleton, migrations vs push, Supabase pooler, generated-client gotchas
- `references/server-and-app.md`: the `build-app`/`server` split, plugins, CORS, logger redaction, health checks, shutdown, Vercel handler
- `references/layers.md`: module anatomy, code for every layer, transactions, concurrency, error model
- `references/auth-sessions.md`: server-side session cookie flow (Argon2, hashed tokens, `__Host-` cookie, `preHandler`)
- `references/tooling-and-testing.md`: tsconfig set, Biome rules and overrides, Vitest patterns (in-memory repo, `inject` + `spyOn`)
- `references/ci-cd.md`: CI and deploy workflows, migration ordering, environments (hml/production), secrets

## Adding a new module to an existing foundation

1. Copy `assets/api/src/modules/items/` → `modules/<name>/` and rename `item`/`Item`/`items`.
2. Add the Prisma model. Use `@@map("snake_plural")`, `@db.Timestamptz(3)` for instants, an index on foreign keys, and `version Int @default(1)` if concurrent edits matter. Then `prisma migrate dev --name add_<name>`.
3. Register the routes in `build-app.ts`: `app.register(<name>Routes, { prefix: "/api/v1/<name>" })`.
4. Add domain errors in `<name>.errors.ts` (or shared ones in `shared/errors.ts`), each with a stable `SCREAMING_SNAKE` code.
5. Write `<name>.service.spec.ts` (in-memory repo) and `<name>.routes.spec.ts` (inject + spyOn). Run `npm run check`.

## Non-negotiables (and why)

- **No `process.env` outside `env.ts`.** A single Zod-parsed source fails fast at boot instead of failing later at runtime.
- **`build-app.ts` never calls `listen`.** That's what lets tests and serverless reuse the same app.
- **Only repositories import `prisma`.** Services receive no `PrismaClient`, raw filters, or `Prisma.*CreateInput` from controllers. The exception: a service may receive the client only to open `$transaction`.
- **Every relative import ends in `.js`.** NodeNext resolution requires it, and the build breaks without it.
- **Generated Prisma client is gitignored**, so `prisma generate` runs before typecheck, test, and build (in CI too).
- **No stack traces or internals in 500 responses.** Log with `request.log.error`, and return a generic message.
- **Hiding a button is not authorization.** Every permission check is repeated in the service, using the authenticated `request.user`, never an owner ID sent by the client.
- **Outputs are built on purpose**: `select` only the fields needed, and never return `passwordHash` or token hashes.

## Extensions the foundation is designed for (not in the base templates)

Add these as plugins under `plugins/` when needed: `@fastify/helmet` (security headers), `@fastify/rate-limit` (login brute force), `@fastify/swagger` (OpenAPI), Sentry (5xx only, scrubbed), an audit-log table separate from technical logs, AES-256-GCM field encryption with a `keyVersion` for sensitive columns, and object storage for files (the DB keeps only the key, MIME type, size and checksum). Keep the same rule for each: the plugin is registered in `build-app.ts`, and its config comes from `env.ts`.
