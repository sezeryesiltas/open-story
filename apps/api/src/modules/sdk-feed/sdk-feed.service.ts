import { sdkFeedRequestSchema } from '@open-story/contracts';
import type { SdkFeedRequestDto, SdkFeedResponseDto } from '@open-story/contracts';

import { ApiServiceError } from '../../common/filters/api-error.ts';
import { StaticTokenGuard } from '../../sdk-auth/static-token.guard.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';
import { SdkFeedRepository } from './sdk-feed.repository.ts';

export class SdkFeedService {
  private readonly repository: SdkFeedRepository;
  private readonly platformRepository: StoryPlatformRepository;
  private readonly staticTokenGuard: StaticTokenGuard;

  constructor(
    repository: SdkFeedRepository,
    platformRepository: StoryPlatformRepository,
    staticTokenGuard: StaticTokenGuard,
  ) {
    this.repository = repository;
    this.platformRepository = platformRepository;
    this.staticTokenGuard = staticTokenGuard;
  }

  async resolve(payload: SdkFeedRequestDto, authorization?: string): Promise<SdkFeedResponseDto> {
    const parsedPayload = sdkFeedRequestSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'SDK feed payload is invalid.');
    }

    const guardResult = await this.staticTokenGuard.validateRequest({
      headers: {
        authorization,
      },
      body: {
        client_id: parsedPayload.data.client_id,
      },
    });

    if (!guardResult.ok) {
      if (guardResult.error.statusCode === 401) {
        throw ApiServiceError.unauthorized(guardResult.error.message);
      }

      throw ApiServiceError.forbidden(guardResult.error.message);
    }

    const client = this.platformRepository.getSingletonClient();
    if (client.clientId !== parsedPayload.data.client_id) {
      throw ApiServiceError.unauthorized('Invalid client_id for this SDK environment.');
    }

    if (!client.isActive) {
      throw ApiServiceError.forbidden('Client is inactive.');
    }

    return this.repository.buildSnapshot(parsedPayload.data);
  }
}
