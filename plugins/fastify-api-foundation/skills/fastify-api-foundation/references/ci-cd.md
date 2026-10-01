# CI/CD, environments & deploy

Templates: `assets/github/ci.yml`, `assets/github/deploy.yml`, `assets/api/vercel.json`, `assets/root/docker-compose.yml`.

## Branch → environment model

| Branch | Environment | APP_ENV | Vercel target |
| --- | --- | --- | --- |
| feature/* → PR | (CI only) | — | — |
| `hml` | staging | hml | preview |
| `main` | production | production | `--prod` |

Each environment gets its own database (a separate Supabase project), its own secrets, and its own GitHub Environment. Never copy real data into lower environments.

## CI (`ci.yml`, on pull_request to hml/main)

```text
checkout → setup-node 22 (cache npm) → npm ci → prisma generate → lint → typecheck → test → build
```
`prisma generate` comes first because the client is gitignored and typecheck needs it.

## Deploy (`deploy.yml`, on push to hml/main + manual dispatch)

```text
npm ci → prisma generate → lint/typecheck/test
  → prisma migrate deploy   (APP_ENV + DIRECT_URL from environment secrets)
  → vercel pull / build / deploy --prebuilt (API project)
  → curl $API_URL/health/ready (retry 3)
  → vercel pull / build / deploy --prebuilt (web project)
```
- `concurrency: deploy-${{ github.ref }}` with `cancel-in-progress: false` keeps two migrations from ever running at once.
- **Migrate before deploying code.** Migrations must therefore be backward-compatible with the currently running code (expand → deploy → contract). Never run destructive changes automatically.
- `vercel.json` sets `{ "git": { "deploymentEnabled": false } }` so Vercel's own git integration doesn't deploy unvalidated code. GitHub Actions is the only path to production.
- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_API`, `VERCEL_PROJECT_ID_WEB`, `DIRECT_URL` (per environment). Runtime vars (`DATABASE_URL`, `CORS_ORIGIN`, `COOKIE_SAME_SITE`, `NODE_ENV`, `APP_ENV`) live in the Vercel project settings.

## Vercel specifics

- `server.ts` exports a default `(req, res)` handler that forwards to `app.server`, and skips `listen` when `process.env.VERCEL` is set. The Fastify instance is reused across warm invocations.
- Serverless and Postgres: always use the pooled `DATABASE_URL` (Supabase transaction pooler, `?pgbouncer=true`), or every cold start opens new connections.
- Scheduled jobs: Vercel Cron → an internal endpoint protected by a secret header, idempotent and short. Move long work to a real queue/worker.

## Local parity

`docker-compose.yml` runs `postgres:17-alpine` with a `pg_isready` healthcheck and a named volume. `npm run db:up` / `db:down` (down keeps the data, while `down -v` wipes it).

## Other hosts

The foundation is host-agnostic. For Railway, Fly, Render or a container, delete the handler export, `node dist/server.js` is the start command, and `migrate deploy` runs as a release step. Keep the order: validate → migrate → deploy → health check.
