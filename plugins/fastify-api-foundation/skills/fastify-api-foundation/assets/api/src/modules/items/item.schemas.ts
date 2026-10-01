import { z } from "zod";

export const itemStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const createItemSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

// `version` = last version the client read (optimistic concurrency).
export const updateItemSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: itemStatusSchema.optional(),
  version: z.number().int().positive(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const itemIdParamSchema = z.object({
  id: z.uuid(),
});

// Query strings are always strings: coerce numbers, default the rest.
export const listItemsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: itemStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
