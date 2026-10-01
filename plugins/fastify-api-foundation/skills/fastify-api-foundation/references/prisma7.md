# Prisma 7 setup

Templates: `assets/api/prisma/schema.prisma`, `assets/api/prisma.config.ts`, `assets/api/src/lib/prisma.ts`, `assets/api/prisma/seed.ts`.

## What changed in v7, and how this foundation handles it

| v7 requirement | Handling |
| --- | --- |
| New `prisma-client` generator with explicit `output` | `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`. Import from `../generated/prisma/client.js`, **not** `@prisma/client`. |
| Datasource URL no longer lives in `schema.prisma` | `datasource db { provider = "postgresql" }` only. The URL comes from `prisma.config.ts`. |
| `prisma.config.ts` is the CLI config | It sets the schema path, migrations path, and datasource URL (`DIRECT_URL ?? DATABASE_URL`). It loads `dotenv/config` itself. |
| Driver adapters are required | `new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })` |
| ESM-first | Works with `"type": "module"` + NodeNext |

## Two URLs, two consumers

- **Runtime** (`lib/prisma.ts`) uses `env.DATABASE_URL`, the pooled connection (Supabase transaction pooler, port 6543).
- **CLI** (`prisma.config.ts`) uses `DIRECT_URL` and falls back to `DATABASE_URL`. Migrations need a session-capable connection because pgbouncer transaction mode breaks DDL and advisory locks. The config **throws** if a `migrate` command runs with `APP_ENV` hml/production and no `DIRECT_URL`, so a migration can never run silently through the pooler.

## Client singleton

`lib/prisma.ts` exports one `prisma` instance, imported only by repositories, health checks and seeds. `server.ts` calls `prisma.$disconnect()` on shutdown and on a failed `listen`.

## Schema conventions

- Models are `PascalCase` and tables are `@@map("snake_plural")`.
- IDs: `@default(uuid())` (or `cuid()`). Be consistent per project.
- Instants: `DateTime @db.Timestamptz(3)`. Store UTC instants, send ISO 8601 with an offset, and convert to the user's timezone in the UI.
- `createdAt @default(now())`, `updatedAt @updatedAt` on every model.
- Index every FK (`@@index([ownerId])`), plus composite indexes for range queries (`@@index([ownerId, startsAt, endsAt])`).
- Use `onDelete: Cascade` for owned children and `SetNull` for optional references.
- Add `version Int @default(1)` for optimistic concurrency on records edited concurrently.
- Use enums for closed status sets, and mirror them with `z.enum` in schemas.
- Prefer soft delete (a status or `archivedAt`) when data has retention value.

## Commands (wired as npm scripts)

| Script | Use |
| --- | --- |
| `prisma:generate` | After every schema change, and before typecheck/test/build (CI does this first) |
| `prisma:migrate:dev -- --name x` | Local: creates a migration SQL file and applies it. Commit `prisma/migrations/**`. |
| `prisma:migrate:deploy` | CI/CD only. Applies pending migrations without generating new ones. |
| `db:push` | Quick local prototyping without migration files. Never in hosted envs. |
| `prisma:validate` | Part of `npm run check` |
| `db:seed` | `tsx prisma/seed.ts`. Make it idempotent (`upsert`). |
| `db:setup` | `db:up && db:push && db:seed` for a fresh local DB |

## Gotchas

- The generated client is gitignored and excluded from Biome (`!**/src/generated/prisma`). A fresh clone fails typecheck until `prisma generate` runs.
- `build` = `prisma generate && tsc -p tsconfig.build.json`, so deployments always have the client.
- Import Prisma types (`Prisma`, enums, model types) from the generated path: `import { Prisma, type User } from "../../generated/prisma/client.js"`.
- Type dynamic `where`/`orderBy` objects as `Prisma.ItemWhereInput` / `Prisma.ItemOrderByWithRelationInput` instead of `any`.
- `$queryRawUnsafe("SELECT 1")` is fine for health checks. Use tagged `$queryRaw` for anything with parameters.
- A baseline migration on an existing DB: create `0_init` with `prisma migrate diff --from-empty --to-schema-datamodel ... --script`, then `prisma migrate resolve --applied 0_init`.
