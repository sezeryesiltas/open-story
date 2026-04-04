import type { AdminSessionRecord, AdminUserRecord } from '@open-story/contracts';

import { ApiServiceError } from '../common/filters/api-error.ts';
import { StoryPlatformRepository } from '../story-platform/story-platform.repository.ts';
import { AdminSessionJwtGuard } from './admin-session-jwt.guard.ts';
import { SimpleJwtService } from './simple-jwt.ts';

export type AdminAccessContext = {
  user: AdminUserRecord;
  session: AdminSessionRecord;
};

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

    return { user, session };
  }
}
