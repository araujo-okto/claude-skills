import type { User } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateSessionData, SessionWithUser } from "./auth.types.js";

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
} as const;

// Interface + Prisma implementation: services depend on the interface,
// tests provide an in-memory implementation.
export interface AuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | null>;
  createSession(data: CreateSessionData): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
}

export class PrismaAuthRepository implements AuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<SessionWithUser | null> {
    return prisma.session.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: authUserSelect },
      },
    });
  }

  async createSession(data: CreateSessionData): Promise<void> {
    await prisma.session.create({ data });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }
}
