import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../build-app.js";
import { generateSessionToken } from "../../lib/session-token.js";
import { SESSION_COOKIE_NAME } from "../../plugins/auth.plugin.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import type { SessionWithUser } from "../auth/auth.types.js";
import { ItemRepository } from "./item.repository.js";
import type { ItemEntity } from "./item.types.js";

// Pattern B: real routes + preHandler + Zod + error handler via inject;
// the DB is stubbed at the repository boundary by spying on prototypes.
describe("Item routes (HTTP)", () => {
  const app = buildApp({ logger: false });
  const token = generateSessionToken();

  const session: SessionWithUser = {
    id: "s1",
    userId: "u1",
    tokenHash: "irrelevant-when-mocked",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user: {
      id: "u1",
      name: "Test",
      email: "t@example.com",
      role: "MEMBER",
      status: "ACTIVE",
    },
  };

  const item: ItemEntity = {
    id: "8f9c1c9e-6c2b-4d5e-9a7f-1b2c3d4e5f60",
    ownerId: "u1",
    name: "Example",
    description: null,
    status: "ACTIVE",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      PrismaAuthRepository.prototype,
      "findSessionByTokenHash",
    ).mockResolvedValue(session);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/items" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 VALIDATION_ERROR for an invalid body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      cookies: { [SESSION_COOKIE_NAME]: token },
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("creates an item owned by the session user", async () => {
    vi.spyOn(ItemRepository.prototype, "findByName").mockResolvedValue(null);
    const create = vi
      .spyOn(ItemRepository.prototype, "create")
      .mockResolvedValue(item);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      cookies: { [SESSION_COOKIE_NAME]: token },
      payload: { name: "Example", ownerId: "someone-else" },
    });

    expect(res.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "u1" }),
    );
  });
});
