import type { StaticTokenRecord } from '@open-story/contracts';
import { forbidden, unauthorized, type AuthErrorResponse } from '../common/auth-error-response.ts';
import { verifyStaticTokenHash } from './static-token-hash.ts';

export type FeedRequestBody = {
  client_id?: string;
};

export type SdkRequest = {
  headers: Record<string, string | undefined>;
  body: FeedRequestBody;
};

export type StaticToken = Pick<
  StaticTokenRecord,
  'id' | 'clientId' | 'tokenHash' | 'revokedAt' | 'isActive'
>;

export interface StaticTokenStore {
  findByClientId(clientId: string): Promise<StaticToken[]>;
}

export type StaticTokenGuardResult =
  | { ok: true; token: StaticToken }
  | { ok: false; error: AuthErrorResponse };

export class StaticTokenGuard {
  private readonly tokenStore: StaticTokenStore;

  constructor(tokenStore: StaticTokenStore) {
    this.tokenStore = tokenStore;
  }

  async validateRequest(req: SdkRequest): Promise<StaticTokenGuardResult> {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return { ok: false, error: unauthorized('AUTH_UNAUTHORIZED') };
    }

    const clientId = req.body.client_id;
    if (!clientId) {
      return {
        ok: false,
        error: unauthorized('AUTH_UNAUTHORIZED', 'client_id is required for SDK feed requests.'),
      };
    }

    const candidates = await this.tokenStore.findByClientId(clientId);
    const match = candidates.find((candidate) => verifyStaticTokenHash(token, candidate.tokenHash));

    if (!match) {
      return { ok: false, error: unauthorized('AUTH_UNAUTHORIZED', 'Invalid static token.') };
    }

    if (!match.isActive || match.revokedAt) {
      return {
        ok: false,
        error: forbidden('TOKEN_REVOKED', 'Static token is revoked or inactive.'),
      };
    }

    if (match.clientId !== clientId) {
      return {
        ok: false,
        error: forbidden('TOKEN_CLIENT_MISMATCH', 'Token does not belong to the provided client_id.'),
      };
    }

    return { ok: true, token: match };
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
