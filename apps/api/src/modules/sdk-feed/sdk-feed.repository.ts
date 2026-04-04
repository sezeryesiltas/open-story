import { SdkFeedRequestDto, SdkFeedResponseDto } from '@open-story/contracts';

import { PublishResolutionService } from '../../publish/publish-resolution.service.ts';

export class SdkFeedRepository {
  private readonly publishResolutionService: PublishResolutionService;

  constructor(publishResolutionService: PublishResolutionService) {
    this.publishResolutionService = publishResolutionService;
  }

  buildSnapshot(payload: SdkFeedRequestDto): SdkFeedResponseDto {
    return {
      client_id: payload.client_id,
      placement_key: payload.placement_key,
      context: {
        platform: payload.platform,
        app_version: payload.app_version,
        user_segments: payload.user_segments ?? [],
      },
      resolved_set: this.publishResolutionService.resolveFeed(payload),
      generated_at: new Date().toISOString(),
    };
  }
}
