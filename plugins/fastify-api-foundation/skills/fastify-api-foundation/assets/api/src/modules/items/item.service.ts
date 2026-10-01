import { Prisma } from "../../generated/prisma/client.js";
import { prisma as defaultPrisma } from "../../lib/prisma.js";
import { ForbiddenError } from "../../shared/errors.js";
import {
  ItemChangedError,
  ItemNameInUseError,
  ItemNotFoundError,
} from "./item.errors.js";
import { ItemRepository } from "./item.repository.js";
import type { UpdateItemInput } from "./item.schemas.js";
import type {
  CreateItemData,
  ItemEntity,
  ItemFilters,
  ItemSummary,
} from "./item.types.js";

// Use cases: existence, ownership, uniqueness, concurrency. Input is already validated.
export class ItemService {
  constructor(
    private readonly items: ItemRepository = new ItemRepository(),
    // Injected only to open transactions; queries still go through the repository.
    private readonly prisma = defaultPrisma,
  ) {}

  async create(data: CreateItemData): Promise<ItemEntity> {
    if (await this.items.findByName(data.ownerId, data.name)) {
      throw new ItemNameInUseError();
    }
    try {
      return await this.items.create(data);
    } catch (error) {
      // Unique constraint is the real guarantee; map the race to the same error.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ItemNameInUseError();
      }
      throw error;
    }
  }

  async getById(id: string, ownerId: string): Promise<ItemEntity> {
    const item = await this.items.findById(id);
    if (!item) throw new ItemNotFoundError();
    if (item.ownerId !== ownerId) throw new ForbiddenError();
    return item;
  }

  async list(
    filters: ItemFilters,
  ): Promise<{ items: ItemSummary[]; total: number }> {
    return this.items.findMany(filters);
  }

  async update(
    id: string,
    ownerId: string,
    input: UpdateItemInput,
  ): Promise<ItemEntity> {
    const { version, ...data } = input;

    return this.prisma.$transaction(async (tx) => {
      const current = await this.items.findById(id, tx);
      if (!current) throw new ItemNotFoundError();
      if (current.ownerId !== ownerId) throw new ForbiddenError();

      if (data.name && data.name !== current.name) {
        if (await this.items.findByName(ownerId, data.name, tx)) {
          throw new ItemNameInUseError();
        }
      }

      const updated = await this.items.updateIfVersion(id, version, data, tx);
      if (!updated) throw new ItemChangedError();

      const fresh = await this.items.findById(id, tx);
      if (!fresh) throw new ItemNotFoundError();
      return fresh;
    });
  }

  async archive(id: string, ownerId: string, version: number) {
    return this.update(id, ownerId, { status: "ARCHIVED", version });
  }
}
