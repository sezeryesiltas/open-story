import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';

import { PublishResolutionRepository } from '../../publish/publish-resolution.repository.ts';
import { PublishResolutionService } from '../../publish/publish-resolution.service.ts';
import { SdkFeedController } from './sdk-feed.controller';
import { SdkFeedService } from './sdk-feed.service';
import { SdkFeedRepository } from './sdk-feed.repository';

@Module({
  controllers: [SdkFeedController],
  providers: [
    DbService,
    {
      provide: PublishResolutionRepository,
      useFactory: (db: DbService) => new PublishResolutionRepository(db),
      inject: [DbService],
    },
    {
      provide: PublishResolutionService,
      useFactory: (repository: PublishResolutionRepository) => new PublishResolutionService(repository),
      inject: [PublishResolutionRepository],
    },
    {
      provide: SdkFeedRepository,
      useFactory: (publishResolutionService: PublishResolutionService) =>
        new SdkFeedRepository(publishResolutionService),
      inject: [PublishResolutionService],
    },
    SdkFeedService,
  ],
})
export class SdkFeedModule {}
