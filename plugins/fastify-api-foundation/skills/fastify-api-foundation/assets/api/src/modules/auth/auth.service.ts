import { verifyPassword } from "../../lib/password.js";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../lib/session-token.js";
import {
  AccountBlockedError,
  InvalidCredentialsError,
  UnauthorizedError,
} from "../../shared/errors.js";
import {
  type AuthRepository,
  PrismaAuthRepository,
} from "./auth.repository.js";
import type { LoginInput } from "./auth.schemas.js";
import type { AuthUser, SessionWithUser } from "./auth.types.js";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type RequestMetadata = { ipAddress?: string; userAgent?: string };

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository = new PrismaAuthRepository(),
  ) {}

  async login(
    input: LoginInput,
    metadata: RequestMetadata = {},
  ): Promise<{ token: string; user: AuthUser }> {
    const user = await this.authRepository.findUserByEmail(input.email);

    // Same error for "no user", "no password" and "wrong password": don't reveal which.
    if (!user?.passwordHash) {
      throw new InvalidCredentialsError();
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    if (user.status !== "ACTIVE") {
      throw new AccountBlockedError();
    }

    // Only the hash is persisted; the raw token lives in the cookie.
    const token = generateSessionToken();
    await this.authRepository.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ...metadata,
    });

    // Build the output explicitly — never spread the DB row.
    const publicUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return { token, user: publicUser };
  }

  async logout(sessionId: string): Promise<void> {
    await this.authRepository.revokeSession(sessionId);
  }

  async validateSession(token: string): Promise<SessionWithUser> {
    const session = await this.authRepository.findSessionByTokenHash(
      hashSessionToken(token),
    );

    if (!session || session.revokedAt !== null) {
      throw new UnauthorizedError();
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError("Session expired.");
    }
    if (session.user.status !== "ACTIVE") {
      throw new AccountBlockedError();
    }

    return session;
  }
}
