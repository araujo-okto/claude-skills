import type { UserRole, UserStatus } from "../../generated/prisma/client.js";

// Public projection of a user — never includes passwordHash.
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export type CreateSessionData = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

export type SessionWithUser = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUser;
};
