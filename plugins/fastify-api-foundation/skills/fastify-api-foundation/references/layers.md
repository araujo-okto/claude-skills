# Module layers in detail

Template module: `assets/api/src/modules/items/` (routes, controller, service, repository, schemas, types, errors, plus two specs).

## Contents
1. Module anatomy
2. Schemas (Zod)
3. Types (contracts)
4. Controller
5. Service
6. Repository
7. Transactions & optimistic concurrency
8. Error model

## 1. Module anatomy

```text
modules/items/
├── item.routes.ts        # endpoints + preHandlers
├── item.controller.ts    # HTTP adapter
├── item.service.ts       # use cases
├── item.repository.ts    # Prisma access
├── item.schemas.ts       # Zod input schemas (+ inferred input types)
├── item.types.ts         # Entity / DTO / Summary contracts
├── item.errors.ts        # domain errors (AppError subclasses)
├── item.service.spec.ts  # unit (in-memory repository)
└── item.routes.spec.ts   # HTTP integration (inject + spyOn)
```
Files are named `<singular>.<role>.ts` and the folder is plural. Split into `controllers/`, `services/` subfolders only once a module has many files of the same role.

**Protecting routes:** use per-route `{ preHandler: [authenticate] }`, or `app.addHook("preHandler", authenticate)` inside the module's routes function. Fastify encapsulation scopes that hook to the module's prefix only, so public modules stay public.

## 2. Schemas

- One schema per boundary input: `createItemSchema`, `updateItemSchema`, `itemIdParamSchema`, `listItemsQuerySchema`.
- Normalize in the schema with `.trim()`, `.toLowerCase()` for emails, and `.default()` for enums and sort. The output is then canonical.
- Query strings are always strings. Use `z.coerce.number()` for pagination and split CSV lists in the schema with `.transform`.
- Cross-field rules go in `.refine(..., { path: ["field"] })`. Example: `endsAt > startsAt`.
- Dates: `z.iso.datetime({ offset: true })` gives ISO 8601 with a timezone.
- Export `type CreateItemInput = z.infer<typeof createItemSchema>` (or `z.output`, which is the same unless `transform` is used).
- Messages go in the product's language, because the frontend shows them.

## 3. Types: create one only when the meaning changes

| Contract | Example | Source |
| --- | --- | --- |
| Validated input | `CreateItemInput` | `z.infer` of the schema |
| Service/persistence data | `CreateItemData` = input + server-side fields (`ownerId`) | `Pick<ItemEntity, ...> & {...}` |
| Entity | `ItemEntity` | Fields required as in the DB. Don't make every field optional. |
| Output projection | `ItemSummary` | `Pick<ItemEntity, ...>` |
| Update | `UpdateItemData = Partial<Pick<ItemEntity, "name" \| "status">>` | Explicit allow-list |

`Omit<>` doesn't strip fields at runtime, so use `select` or explicit object construction for anything sensitive. Prisma enums and model types may be imported in `*.types.ts` from the generated client.

## 4. Controller

```ts
const itemService = new ItemService();

export async function createItemController(request: FastifyRequest, reply: FastifyReply) {
  const input = createItemSchema.parse(request.body);          // throws ZodError → 400
  const item = await itemService.create({ ...input, ownerId: request.user!.id });
  return reply.status(201).send({ item });                      // wrap in a named key
}
```
- The service is instantiated at module level, once.
- Responses are wrapped in a key (`{ item }`, `{ items }`) so fields like pagination can be added without breaking clients.
- Status codes: 201 for create, 200 for read/update, 204 for delete/logout (`send()` with no body).
- Owner IDs come from `request.user` (set by the auth preHandler), never from the body.

## 5. Service

```ts
export class ItemService {
  constructor(private readonly items: ItemRepository = new ItemRepository()) {}

  async update(id: string, ownerId: string, data: UpdateItemData) {
    const current = await this.items.findById(id);
    if (!current) throw new ItemNotFoundError();
    if (current.ownerId !== ownerId) throw new ForbiddenError();
    if (data.name && data.name !== current.name && (await this.items.findByName(data.name)))
      throw new ItemNameInUseError();
    return this.items.update(id, data);
  }
}
```
- The service is where existence, ownership, uniqueness, state transitions and conflicts are checked.
- Fetch the record and compare `ownerId` (resource-level authorization). A role alone isn't enough.
- For unique fields, check first so the error is friendly. The DB unique constraint remains the real guarantee. Map Prisma `P2002` to the same error to cover races.

## 6. Repository

```ts
type DbClient = PrismaClient | Prisma.TransactionClient;

const itemSelect = { id: true, name: true, status: true, ownerId: true, createdAt: true, updatedAt: true } satisfies Prisma.ItemSelect;

export class ItemRepository {
  async findMany(filters: ItemFilters, db: DbClient = prisma) {
    const where: Prisma.ItemWhereInput = { ownerId: filters.ownerId };
    if (filters.search) where.name = { contains: filters.search, mode: "insensitive" };
    return db.item.findMany({ where, orderBy: { createdAt: "desc" }, select: itemSelect });
  }
}
```
- A reusable `select`/`include` const per module, declared `as const` or `satisfies Prisma.XSelect`, controls exactly what leaves the DB.
- Normalize empty strings to `null` here (`email || null`) when the schema allows `""`.
- Relations: `connect: ids.map(id => ({ id }))` on create, and `set: [...]` on update to replace them.
- The repository has no knowledge of HTTP or users beyond the filter values it receives.
- Optionally declare an `interface ItemRepository` and a `PrismaItemRepository implements` class. That makes in-memory fakes explicit (the auth module pattern). A class whose public shape a fake `implements` works too.

## 7. Transactions & optimistic concurrency

For check-then-write (overlaps, uniqueness across tables, counters):
```ts
constructor(private repo = new ItemRepository(), private readonly prisma = defaultPrisma) {}

return this.prisma.$transaction(async (tx) => {
  const conflicts = await this.repo.findOverlapping(range, tx);
  if (conflicts.length) throw new ConflictError();
  return this.repo.create(data, tx);
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
```
For concurrent edits, the client sends the `version` it last read:
```ts
const updated = await db.item.updateMany({ where: { id, version: input.version }, data: { ...data, version: { increment: 1 } } });
if (updated.count === 0) throw new ItemChangedError();   // 409: "reload and retry"
```

## 8. Error model

`shared/errors.ts`:
```ts
export class AppError extends Error {
  constructor(message: string, public readonly statusCode = 400, public readonly code = "BAD_REQUEST") { super(message); this.name = "AppError"; }
}
```
Shared subclasses: `UnauthorizedError` (401 UNAUTHORIZED), `ForbiddenError` (403 FORBIDDEN), `NotFoundError` (404), `ConflictError` (409). Domain errors live in `<module>.errors.ts` with specific codes (`ITEM_NOT_FOUND`, `ITEM_NAME_IN_USE`). Codes are **stable API**, because the frontend branches on `error.code`, not on the message.

| Category | Status |
| --- | --- |
| Invalid input (Zod) | 400 VALIDATION_ERROR |
| Not authenticated | 401 |
| Not allowed | 403 |
| Not found / not yours (when hiding existence) | 404 |
| Business conflict / stale version | 409 |
| Unexpected | 500, logged |
