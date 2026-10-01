# Environment & configuration

Template: `assets/api/src/env.ts`, `assets/api/.env.example`.

## Principles

1. `env.ts` is the only reader of `process.env`. Everything else imports `env`. This yields a typed config object, and a bad deploy fails at boot with a precise Zod issue.
2. Export **both** `envSchema` (for tests) and `env = envSchema.parse(process.env)` (for the app). Tests call `envSchema.parse({...})` with fixtures and never mutate the real process env.
3. `import "dotenv/config"` at the top of `env.ts` (and of `prisma.config.ts`). It loads `.env` from the **current working directory**. npm workspace scripts run with cwd = `apps/api`, so the file is `apps/api/.env`. Files like `.env.development` are **not** loaded automatically. Either name the real file `.env`, or call `dotenv.config({ path: ... })` explicitly.
4. Hosted environments (Vercel etc.) inject variables directly. No `.env` file is committed. `.gitignore` ignores `.env` and `.env.*` but keeps `!.env.example` and `!.env.*.example`.

## Two environment axes

| Var | Values | Meaning |
| --- | --- | --- |
| `NODE_ENV` | development, test, production | How the code runs (cookie `secure`, CORS strictness, prefixes) |
| `APP_ENV` | development, hml, production | Which deployment this is (staging/"hml" vs prod). It drives migration guards and logs. |

Staging runs `NODE_ENV=production` with `APP_ENV=hml`, so it behaves exactly like prod while staying identifiable. A `superRefine` rejects `NODE_ENV=production` + `APP_ENV=development`.

## Variables in the base

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | 3333 | `z.coerce.number()` |
| `HOST` | 0.0.0.0 | Needed inside containers |
| `LOG_LEVEL` | info | Pino levels enum, including `silent` |
| `DATABASE_URL` | required | Runtime connection. On Supabase, use the **transaction pooler** (port 6543, `?pgbouncer=true`). |
| `DIRECT_URL` | optional | **Migrations only** (direct or session pooler, port 5432). The runtime never needs it. `prisma.config.ts` requires it for `migrate` when `APP_ENV` is hml/production. |
| `CORS_ORIGIN` | http://localhost:5173 | Comma-separated. Trimmed, trailing `/` stripped, transformed to `string[]`. `*` wildcards are allowed (e.g. Vercel previews `https://*-team.vercel.app`). |
| `COOKIE_SAME_SITE` | lax | `none` only when web and API live on different sites. The cookie is then `Secure` + `Partitioned`. |

## Robustness patterns worth copying

- A **sanitize** helper strips whitespace and surrounding quotes. Values pasted into hosting dashboards often arrive as `"value"`.
- `.optional().transform(v => clean(v) || default).pipe(z.enum([...]))` gives an empty string and `undefined` the same default, then validates the result.
- **Production guard**: in production, reject a `DATABASE_URL` whose host is loopback (`localhost`, `127.*`, `::1`). This catches a forgotten local URL before it ships.
- Zod 4 idioms: `z.url()`, `z.email()`, `ctx.addIssue({ code: "custom", ... })`. `z.ZodIssueCode.custom` and `z.string().url()` still work but are deprecated.

## Adding a variable

1. Add it to `envSchema` with a safe default, or make it required.
2. Add it to `.env.example` with a comment (purpose, local value, hosted value).
3. Add an `env.spec.ts` case if it has transform or guard logic.
4. Register it in the hosting dashboard and the GitHub environment secrets.
