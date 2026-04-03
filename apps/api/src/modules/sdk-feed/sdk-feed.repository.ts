import { Injectable } from '@nestjs/common';
import { SdkFeedRequestDto, SdkFeedResponseDto } from '@open-story/contracts';

@Injectable()
export class SdkFeedRepository {
  buildSnapshot(payload: SdkFeedRequestDto): SdkFeedResponseDto {
    return {
      client_id: payload.client_id,
      placement_key: payload.placement_key,
      context: {
        platform: payload.platform,
        app_version: payload.app_version,
        user_segments: payload.user_segments ?? [],
      },
      resolved_set: null,
      generated_at: new Date().toISOString(),
    };
  }
}
