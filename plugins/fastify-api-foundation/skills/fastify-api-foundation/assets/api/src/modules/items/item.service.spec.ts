import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "../../shared/errors.js";
import {
  ItemChangedError,
  ItemNameInUseError,
  ItemNotFoundError,
} from "./item.errors.js";
import type { ItemRepository } from "./item.repository.js";
import { ItemService } from "./item.service.js";
import type {
  CreateItemData,
  ItemEntity,
  UpdateItemData,
} from "./item.types.js";

// Pattern A: in-memory repository — no database, runs in milliseconds.
class InMemoryItemRepository {
  items: ItemEntity[] = [];

  async create(data: CreateItemData): Promise<ItemEntity> {
    const item: ItemEntity = {
      id: crypto.randomUUID(),
      ownerId: data.ownerId,
      name: data.name,
      description: data.description ?? null,
      status: "ACTIVE",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.push(item);
    return item;
  }

  async findById(id: string) {
    return this.items.find((i) => i.id === id) ?? null;
  }

  async findByName(ownerId: string, name: string) {
    return (
      this.items.find((i) => i.ownerId === ownerId && i.name === name) ?? null
    );
  }

  async updateIfVersion(id: string, version: number, data: UpdateItemData) {
    const item = this.items.find((i) => i.id === id && i.version === version);
    if (!item) return false;
    Object.assign(item, data, { version: item.version + 1 });
    return true;
  }
}

// Fake client: runs the transaction callback directly.
const fakePrisma = {
  $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
};

describe("ItemService", () => {
  let repo: InMemoryItemRepository;
  let service: ItemService;

  beforeEach(() => {
    repo = new InMemoryItemRepository();
    service = new ItemService(
      repo as unknown as ItemRepository,
      fakePrisma as never,
    );
  });

  it("rejects a duplicate name for the same owner", async () => {
    await service.create({ ownerId: "u1", name: "First" });
    await expect(
      service.create({ ownerId: "u1", name: "First" }),
    ).rejects.toBeInstanceOf(ItemNameInUseError);
  });

  it("forbids reading another owner's item", async () => {
    const item = await service.create({ ownerId: "u1", name: "Mine" });
    await expect(service.getById(item.id, "u2")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("throws not found for unknown ids", async () => {
    await expect(
      service.update("missing", "u1", { version: 1 }),
    ).rejects.toBeInstanceOf(ItemNotFoundError);
  });

  it("rejects a stale version", async () => {
    const item = await service.create({ ownerId: "u1", name: "Doc" });
    await service.update(item.id, "u1", { name: "Doc v2", version: 1 });
    await expect(
      service.update(item.id, "u1", { name: "Doc v3", version: 1 }),
    ).rejects.toBeInstanceOf(ItemChangedError);
  });
});
