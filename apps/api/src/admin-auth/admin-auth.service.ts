import { randomUUID } from 'node:crypto';
import type { AdminUserRecord } from '@open-story/contracts';
import { unauthorized, type AuthErrorResponse } from '../common/auth-error-response.ts';
import { verifyPassword } from './password.ts';

export type AdminUser = Pick<AdminUserRecord, 'id' | 'email' | 'passwordHash' | 'isActive'>;

export type AdminSession = {
  id: string;
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
};

export interface AdminUserStore {
  findByEmail(email: string): Promise<AdminUser | null>;
}

export interface AdminSessionStore {
  create(session: AdminSession): Promise<void>;
}

export interface JwtSigner {
  sign(payload: Record<string, unknown>, ttlSeconds: number): string;
}

export type AdminSignInResult =
  | {
      ok: true;
      session: AdminSession;
      accessToken: string;
    }
  | {
      ok: false;
      error: AuthErrorResponse;
    };

export class AdminAuthService {
  private readonly userStore: AdminUserStore;
  private readonly sessionStore: AdminSessionStore;
  private readonly jwtSigner: JwtSigner;
  private readonly sessionTtlSeconds: number;

  constructor(
    userStore: AdminUserStore,
    sessionStore: AdminSessionStore,
    jwtSigner: JwtSigner,
    sessionTtlSeconds = 60 * 60 * 12,
  ) {
    this.userStore = userStore;
    this.sessionStore = sessionStore;
    this.jwtSigner = jwtSigner;
    this.sessionTtlSeconds = sessionTtlSeconds;
  }

  async signIn(email: string, password: string): Promise<AdminSignInResult> {
    const user = await this.userStore.findByEmail(email.toLowerCase());

    if (!user || !user.isActive) {
      return { ok: false, error: unauthorized('AUTH_UNAUTHORIZED', 'Invalid email or password.') };
    }

    const passwordValid = verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return { ok: false, error: unauthorized('AUTH_UNAUTHORIZED', 'Invalid email or password.') };
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.sessionTtlSeconds * 1000);

    const session: AdminSession = {
      id: randomUUID(),
      userId: user.id,
      issuedAt,
      expiresAt,
    };

    await this.sessionStore.create(session);

    const accessToken = this.jwtSigner.sign(
      {
        sub: user.id,
        sid: session.id,
        scope: 'admin',
      },
      this.sessionTtlSeconds,
    );

    return { ok: true, session, accessToken };
  }
}
