import type { ItemStatus } from "../../generated/prisma/client.js";
import type { CreateItemInput, ListItemsQuery } from "./item.schemas.js";

// Entity: fields are required exactly as stored.
export type ItemEntity = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: ItemStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

// Persistence data = validated input + server-derived fields.
export type CreateItemData = CreateItemInput & { ownerId: string };

// Explicit allow-list of updatable fields.
export type UpdateItemData = Partial<
  Pick<ItemEntity, "name" | "description" | "status">
>;

export type ItemFilters = ListItemsQuery & { ownerId: string };

// Output projection for lists.
export type ItemSummary = Pick<
  ItemEntity,
  "id" | "name" | "status" | "updatedAt"
>;
