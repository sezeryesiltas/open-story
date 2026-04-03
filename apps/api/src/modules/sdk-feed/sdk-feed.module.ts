import { Module } from '@nestjs/common';
import { SdkFeedController } from './sdk-feed.controller';
import { SdkFeedService } from './sdk-feed.service';
import { SdkFeedRepository } from './sdk-feed.repository';

@Module({
  controllers: [SdkFeedController],
  providers: [SdkFeedService, SdkFeedRepository],
})
export class SdkFeedModule {}
