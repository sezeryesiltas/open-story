import { createHmac, timingSafeEqual } from 'node:crypto';

import type { JwtPayload, JwtSigner, JwtVerifier } from './admin-session-jwt.guard.ts';

type JwtHeader = {
  alg: 'HS256';
  typ: 'JWT';
};

type StoredJwtPayload = JwtPayload & {
  iat: number;
};

const DEFAULT_ADMIN_JWT_SECRET = 'open-story-local-admin-jwt-secret';

const encodeBase64Url = (value: string): string => Buffer.from(value).toString('base64url');

const decodeBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const normalizeSecret = (): string =>
  process.env.OPEN_STORY_ADMIN_JWT_SECRET?.trim() || DEFAULT_ADMIN_JWT_SECRET;

export class SimpleJwtService implements JwtSigner, JwtVerifier {
  private readonly secret: string;

  constructor(secret = normalizeSecret()) {
    this.secret = secret;
  }

  sign(payload: Record<string, unknown>, ttlSeconds: number): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const storedPayload: StoredJwtPayload = {
      ...(payload as Omit<StoredJwtPayload, 'iat' | 'exp'>),
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    };

    const encodedHeader = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' } satisfies JwtHeader));
    const encodedPayload = encodeBase64Url(JSON.stringify(storedPayload));
    const signature = this.signInput(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verify(token: string): JwtPayload | null {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return null;
    }

    const expectedSignature = this.signInput(`${encodedHeader}.${encodedPayload}`);
    const expectedBuffer = Buffer.from(expectedSignature);
    const actualBuffer = Buffer.from(encodedSignature);

    if (expectedBuffer.length !== actualBuffer.length) {
      return null;
    }

    if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
      return null;
    }

    try {
      const parsedPayload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<StoredJwtPayload>;

      if (
        typeof parsedPayload.sub !== 'string' ||
        typeof parsedPayload.sid !== 'string' ||
        typeof parsedPayload.scope !== 'string' ||
        typeof parsedPayload.exp !== 'number'
      ) {
        return null;
      }

      return {
        sub: parsedPayload.sub,
        sid: parsedPayload.sid,
        scope: parsedPayload.scope,
        exp: parsedPayload.exp,
      };
    } catch {
      return null;
    }
  }

  private signInput(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }
}
