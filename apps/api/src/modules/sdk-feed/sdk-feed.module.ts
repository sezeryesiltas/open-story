import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { SdkFeedController } from './sdk-feed.controller';
import { SdkFeedService } from './sdk-feed.service';
import { SdkFeedRepository } from './sdk-feed.repository';

@Module({
  controllers: [SdkFeedController],
  providers: [DbService, SdkFeedService, SdkFeedRepository],
})
export class SdkFeedModule {}
