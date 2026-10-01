import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CreateItemData,
  ItemEntity,
  ItemFilters,
  ItemSummary,
  UpdateItemData,
} from "./item.types.js";

// Lets callers pass a transaction client (`tx`) into any method.
export type DbClient = PrismaClient | Prisma.TransactionClient;

const itemSelect = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ItemSelect;

const itemSummarySelect = {
  id: true,
  name: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.ItemSelect;

// Only layer that touches Prisma. No HTTP, no permission decisions.
export class ItemRepository {
  async create(
    data: CreateItemData,
    db: DbClient = prisma,
  ): Promise<ItemEntity> {
    return db.item.create({
      data: {
        ownerId: data.ownerId,
        name: data.name,
        description: data.description || null,
      },
      select: itemSelect,
    });
  }

  async findById(
    id: string,
    db: DbClient = prisma,
  ): Promise<ItemEntity | null> {
    return db.item.findUnique({ where: { id }, select: itemSelect });
  }

  async findByName(
    ownerId: string,
    name: string,
    db: DbClient = prisma,
  ): Promise<ItemEntity | null> {
    return db.item.findUnique({
      where: { ownerId_name: { ownerId, name } },
      select: itemSelect,
    });
  }

  async findMany(
    filters: ItemFilters,
    db: DbClient = prisma,
  ): Promise<{ items: ItemSummary[]; total: number }> {
    const where: Prisma.ItemWhereInput = { ownerId: filters.ownerId };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.name = { contains: filters.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      db.item.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        select: itemSummarySelect,
      }),
      db.item.count({ where }),
    ]);

    return { items, total };
  }

  // Optimistic concurrency: only updates if the version still matches.
  async updateIfVersion(
    id: string,
    version: number,
    data: UpdateItemData,
    db: DbClient = prisma,
  ): Promise<boolean> {
    const result = await db.item.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count === 1;
  }
}
