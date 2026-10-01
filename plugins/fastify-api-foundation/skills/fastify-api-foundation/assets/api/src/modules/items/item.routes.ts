import type { FastifyInstance } from "fastify";
import { authenticate } from "../../plugins/auth.plugin.js";
import {
  createItemController,
  getItemController,
  listItemsController,
  updateItemController,
} from "./item.controller.js";

// Method + URL + preHandlers only. No logic, no Prisma.
export async function itemRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate); // every route in this module is protected

  app.post("/", createItemController);
  app.get("/", listItemsController);
  app.get("/:id", getItemController);
  app.put("/:id", updateItemController);
}
