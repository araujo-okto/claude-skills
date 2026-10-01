# Server-side session authentication

Templates: `assets/api/src/lib/password.ts`, `assets/api/src/lib/session-token.ts`, `assets/api/src/plugins/auth.plugin.ts`, plus the `User`/`Session` models in `assets/api/prisma/schema.prisma`.

## Why sessions instead of a JWT in localStorage

An HttpOnly cookie can't be read by JS, which removes XSS token theft. A DB-backed session can be revoked instantly (logout, blocked user). The cost is one indexed lookup per request.

## Models

```prisma
model User    { id String @id @default(uuid()); email String @unique; passwordHash String?; role ...; status UserStatus @default(ACTIVE); sessions Session[] }
model Session { id String @id @default(uuid()); userId String; tokenHash String @unique; expiresAt DateTime; revokedAt DateTime?; ipAddress String?; userAgent String?
                user User @relation(fields: [userId], references: [id], onDelete: Cascade); @@index([userId]) }
```

## Flow

```text
POST /api/v1/auth/login
  → loginSchema.parse (email lowercase/trim, password min)
  → repo.findUserByEmail → generic InvalidCredentialsError (401) if missing or wrong password  (don't reveal which)
  → verifyPassword (argon2)  → status must be ACTIVE else AccountBlockedError (403)
  → token = randomBytes(32).hex ; store sha256(token) + expiresAt (e.g. 7d) + ip + UA
  → reply.setCookie(SESSION_COOKIE_NAME, token, cookieOptions) ; 200 { user: safeUser }

preHandler authenticate:
  cookie → sha256 → findSessionByTokenHash (include user select safe fields)
  → reject if missing / revokedAt set / expiresAt <= now / user.status !== ACTIVE  (UnauthorizedError 401)
  → request.user = session.user ; request.session = session

POST /logout → revoke session (set revokedAt) → clearCookie with the SAME options → 204
GET  /me     → 200 { user: request.user }
```

## Cookie options

```ts
const isCrossSite = env.COOKIE_SAME_SITE === "none";
{ path: "/", httpOnly: true, secure: env.NODE_ENV === "production" || isCrossSite,
  sameSite: env.COOKIE_SAME_SITE, maxAge: 60 * 60 * 24 * 7, partitioned: isCrossSite }
```
- Name: `__Host-session` in production. The `__Host-` prefix forces `Secure`, `Path=/`, and no `Domain`. Use plain `session` in dev over http.
- Same-site deployments (web and API on one domain or proxy) should use `lax`/`strict`. Use `none` + `Partitioned` only when the API is on another site.
- `clearCookie` must repeat path, sameSite, secure and partitioned, or the browser keeps the cookie.

## Request typing

```ts
declare module "fastify" { interface FastifyRequest { user?: AuthUser; session?: SessionWithUser } }
```
Protect routes with `{ preHandler: [authenticate] }`. Add role guards as extra preHandlers (`requireRole("ADMIN")`), but keep resource ownership checks in services.

## Hardening checklist (add as the project matures)

Rate-limit `/auth/login`. Regenerate the session on login and privilege change. Add an idle timeout (sliding `lastSeenAt`) on top of absolute expiry. Run a cron that deletes expired sessions. Make sure the auth flow's audit log records no passwords or tokens.
