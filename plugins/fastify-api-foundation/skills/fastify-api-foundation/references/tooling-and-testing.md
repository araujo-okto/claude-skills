# Tooling & testing

Templates: `assets/root/tsconfig.base.json`, `assets/root/biome.json`, `assets/api/tsconfig.json`, `assets/api/tsconfig.build.json`, `assets/api/vitest.config.ts`, the specs in `assets/api/src/modules/items/`.

## TypeScript: three files, three jobs

| File | Job |
| --- | --- |
| `tsconfig.base.json` (root) | Shared strictness: `strict`, `noUncheckedIndexedAccess`, `module`/`moduleResolution: NodeNext`, `target: ES2023`, `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames` |
| `apps/api/tsconfig.json` | Editor and `typecheck` (`tsc --noEmit`). Includes `src`, `tests`, `prisma.config.ts`, `vitest.config.ts`. `types: ["node", "vitest/globals"]`. |
| `apps/api/tsconfig.build.json` | Emit: `rootDir: src`, `outDir: dist`, `sourceMap`. Excludes `*.spec.ts` and `tests/`. `types: ["node"]`. |

`noUncheckedIndexedAccess` makes `arr[0]` typed as `T | undefined`. That's annoying at first, but it catches real bugs. `"type": "module"` in the api package plus NodeNext means relative imports must use the `.js` suffix.

## Biome: one config for the whole monorepo

- `files.includes`: `"**"` minus `dist`, `coverage`, `src/generated/prisma`, and docs folders.
- Formatter: enabled, `indentStyle: "space"` (2 spaces and double quotes are the defaults).
- Linter: `recommended: true`. Turn off only the noisy rules with a reason (`noUnknownAtRules` for Tailwind `@apply`, a11y label rules if your component library wraps inputs).
- Override for tests (`**/*.spec.ts`, `**/*.test.ts`, `**/tests/**`): `noExplicitAny: "off"`.
- `vcs: { clientKind: "git", enabled: true, useIgnoreFile: true }` respects `.gitignore`.
- Scripts: `lint` = `biome check .` (lint + format check + import sorting), `format` = `biome format --write .`. Use `biome check --write .` to auto-fix everything.

## Root scripts orchestrate workspaces

`dev:api`, `build:api`, `typecheck` (all apps), `test`, `lint`, `format`, `prisma:*`, `db:*`, and **`check`** = `lint && typecheck && test && build && prisma:validate`. Run `check` locally before pushing. CI mirrors it.

## Vitest

`vitest.config.ts`: `environment: "node"`, `include: ["src/**/*.spec.ts", "tests/**/*.spec.ts"]`. Specs sit next to the code they test.

### Pattern A: service unit tests with an in-memory repository

```ts
class InMemoryItemRepository implements Pick<ItemRepository, "create" | "findById" | "findByName" | "update"> { items: ItemEntity[] = []; ... }
const repo = new InMemoryItemRepository();
const service = new ItemService(repo as unknown as ItemRepository);
await expect(service.update("missing", "owner", {})).rejects.toBeInstanceOf(ItemNotFoundError);
```
These need no DB and run in milliseconds. They're possible because services take dependencies through constructor defaults.

### Pattern B: HTTP integration with `buildApp` + `inject` + `vi.spyOn`

```ts
const app = buildApp({ logger: false });
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(PrismaAuthRepository.prototype, "findSessionByTokenHash").mockResolvedValue(fakeSession);
  vi.spyOn(ItemRepository.prototype, "findMany").mockResolvedValue([fakeItem]);
});
const res = await app.inject({ method: "GET", url: "/api/v1/items", cookies: { session: token } });
expect(res.statusCode).toBe(200);
```
This exercises the real routes, preHandler, Zod parsing, error handler and status codes. The DB is stubbed at the repository boundary by spying on the **prototype**, so the module-level instances are covered too.

### Also cover

- `env.spec.ts`: defaults, coercion, required vars, production guards (via `envSchema.parse(fixture)`).
- `build-app.spec.ts`: builds without listening, allowed CORS preflight returns 204 with credentials, a disallowed origin is not a 500.
- `health.routes.spec.ts`: live 200, ready 200/503 (spy `prisma.$queryRawUnsafe`).
- Every route returns 401 without a cookie and 400 with an invalid body, and the response never contains `passwordHash`.

### Real-DB tests (optional tier)

Point `DATABASE_URL` at a disposable Docker database, run `prisma migrate deploy` in global setup, and truncate between tests. Keep these in `tests/integration/` so the fast suite stays fast.
