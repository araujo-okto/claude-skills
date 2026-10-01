import type { FastifyReply, FastifyRequest } from "fastify";
import { requireUser } from "../../plugins/auth.plugin.js";
import {
  createItemSchema,
  itemIdParamSchema,
  listItemsQuerySchema,
  updateItemSchema,
} from "./item.schemas.js";
import { ItemService } from "./item.service.js";

const itemService = new ItemService();

// HTTP adapter: parse → call service → status + wrapped body.
// Owner always comes from the session, never from the request body.

export async function createItemController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const input = createItemSchema.parse(request.body);
  const user = requireUser(request);
  const item = await itemService.create({ ...input, ownerId: user.id });
  return reply.status(201).send({ item });
}

export async function listItemsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = listItemsQuerySchema.parse(request.query);
  const user = requireUser(request);
  const { items, total } = await itemService.list({
    ...query,
    ownerId: user.id,
  });
  return reply.status(200).send({
    items,
    pagination: { page: query.page, pageSize: query.pageSize, total },
  });
}

export async function getItemController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = itemIdParamSchema.parse(request.params);
  const item = await itemService.getById(id, requireUser(request).id);
  return reply.status(200).send({ item });
}

export async function updateItemController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = itemIdParamSchema.parse(request.params);
  const input = updateItemSchema.parse(request.body);
  const item = await itemService.update(id, requireUser(request).id, input);
  return reply.status(200).send({ item });
}
