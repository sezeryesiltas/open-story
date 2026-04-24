import type { AdminApiKeyRecord, AdminSessionRecord, AdminUserRecord } from '@open-story/contracts';

import { ApiServiceError } from '../common/filters/api-error.ts';
import { verifyStaticTokenHash } from '../sdk-auth/static-token-hash.ts';
import { StoryPlatformRepository } from '../story-platform/story-platform.repository.ts';
import { ADMIN_API_KEY_PREFIX, parseAdminApiKey } from './admin-api-key.ts';
import { AdminSessionJwtGuard } from './admin-session-jwt.guard.ts';
import { SimpleJwtService } from './simple-jwt.ts';

export type AdminSessionAccessContext = {
  kind: 'session';
  user: AdminUserRecord;
  session: AdminSessionRecord;
  adminUserId: string;
  adminApiKey: null;
};

export type AdminApiKeyAccessContext = {
  kind: 'api_key';
  user: null;
  session: null;
  adminUserId: null;
  adminApiKey: AdminApiKeyRecord;
};

export type AdminAccessContext = AdminSessionAccessContext | AdminApiKeyAccessContext;

export class AdminAccessService {
  private readonly repository: StoryPlatformRepository;
  private readonly jwtService: SimpleJwtService;

  constructor(
    repository: StoryPlatformRepository,
    jwtService: SimpleJwtService,
  ) {
    this.repository = repository;
    this.jwtService = jwtService;
  }

  async requireAdminAccess(authorization?: string): Promise<AdminAccessContext> {
    const bearerToken = extractBearerToken(authorization);
    if (bearerToken?.startsWith(ADMIN_API_KEY_PREFIX)) {
      return this.requireAdminApiKeyAccess(bearerToken);
    }

    return this.requireAdminSession(authorization);
  }

  async requireAdminSession(authorization?: string): Promise<AdminSessionAccessContext> {
    const result = await new AdminSessionJwtGuard(this.jwtService, this.repository).validateRequest({
      headers: { authorization },
    });

    if (!result.ok) {
      if (result.error.statusCode === 401) {
        throw ApiServiceError.unauthorized(result.error.message);
      }

      throw ApiServiceError.forbidden(result.error.message);
    }

    const user = this.repository.findAdminUserById(result.userId);
    const session = this.repository.findAdminSessionById(result.sessionId);

    if (!user || !user.isActive || !session) {
      throw ApiServiceError.unauthorized('Invalid admin access token.');
    }

    return {
      kind: 'session',
      user,
      session,
      adminUserId: user.id,
      adminApiKey: null,
    };
  }

  private async requireAdminApiKeyAccess(token: string): Promise<AdminApiKeyAccessContext> {
    const parsedToken = parseAdminApiKey(token);
    if (!parsedToken) {
      throw ApiServiceError.unauthorized('Invalid admin API key.');
    }

    const apiKey = this.repository.findAdminApiKeyById(parsedToken.keyId);
    if (!apiKey || !verifyStaticTokenHash(parsedToken.clientSecret, apiKey.clientSecretHash)) {
      throw ApiServiceError.unauthorized('Invalid admin API key.');
    }

    if (!apiKey.isActive || apiKey.revokedAt) {
      throw ApiServiceError.forbidden('Admin API key is revoked or inactive.');
    }

    return {
      kind: 'api_key',
      user: null,
      session: null,
      adminUserId: null,
      adminApiKey: this.repository.markAdminApiKeyUsed(apiKey.id) ?? apiKey,
    };
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
