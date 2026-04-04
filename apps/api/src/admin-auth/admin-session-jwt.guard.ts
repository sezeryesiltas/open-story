import { forbidden, unauthorized, type AuthErrorResponse } from '../common/auth-error-response.ts';

export type AdminRequest = {
  headers: Record<string, string | undefined>;
};

export type JwtPayload = {
  sub: string;
  sid: string;
  scope: string;
  exp: number;
};

export interface JwtVerifier {
  verify(token: string): JwtPayload | null;
}

export interface AdminSessionReader {
  isSessionActive(sessionId: string, userId: string, now: Date): Promise<boolean>;
}

export type AdminGuardResult =
  | { ok: true; userId: string; sessionId: string }
  | { ok: false; error: AuthErrorResponse };

export class AdminSessionJwtGuard {
  private readonly jwtVerifier: JwtVerifier;
  private readonly sessionReader: AdminSessionReader;

  constructor(
    jwtVerifier: JwtVerifier,
    sessionReader: AdminSessionReader,
  ) {
    this.jwtVerifier = jwtVerifier;
    this.sessionReader = sessionReader;
  }

  async validateRequest(req: AdminRequest, now = new Date()): Promise<AdminGuardResult> {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return { ok: false, error: unauthorized('AUTH_UNAUTHORIZED') };
    }

    const payload = this.jwtVerifier.verify(token);
    if (!payload || payload.scope !== 'admin') {
      return { ok: false, error: unauthorized('AUTH_UNAUTHORIZED', 'Invalid admin access token.') };
    }

    if (payload.exp * 1000 <= now.getTime()) {
      return { ok: false, error: unauthorized('AUTH_UNAUTHORIZED', 'Admin access token expired.') };
    }

    const sessionActive = await this.sessionReader.isSessionActive(payload.sid, payload.sub, now);
    if (!sessionActive) {
      return { ok: false, error: forbidden('AUTH_FORBIDDEN', 'Admin session is no longer active.') };
    }

    return { ok: true, userId: payload.sub, sessionId: payload.sid };
  }
}

const extractBearerToken = (headerValue?: string): string | null => {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim() || null;
};
