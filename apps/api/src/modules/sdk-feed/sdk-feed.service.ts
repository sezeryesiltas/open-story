import { ForbiddenException, Injectable } from '@nestjs/common';
import { SdkFeedRequestDto, SdkFeedResponseDto } from '@open-story/contracts';
import { SdkFeedRepository } from './sdk-feed.repository';

@Injectable()
export class SdkFeedService {
  constructor(private readonly repository: SdkFeedRepository) {}

  resolve(payload: SdkFeedRequestDto, authorization?: string): SdkFeedResponseDto {
    if (!authorization?.startsWith('Bearer ')) {
      throw new ForbiddenException('Missing or invalid static token');
    }

    return this.repository.buildSnapshot(payload);
  }
}
