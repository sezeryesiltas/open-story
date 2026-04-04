import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../../admin-auth/simple-jwt.ts';
import { PublishResolutionRepository } from '../../publish/publish-resolution.repository.ts';
import { PublishResolutionService } from '../../publish/publish-resolution.service.ts';
import { StoryContentRepository } from '../../story-content/story-content.repository.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';
import { StoryGroupSetController } from './story-group-set.controller.ts';
import { StoryGroupSetService } from './story-group-set.service.ts';

@Module({
  controllers: [StoryGroupSetController],
  providers: [
    DbService,
    {
      provide: StoryPlatformRepository,
      useFactory: (db: DbService) => new StoryPlatformRepository(db),
      inject: [DbService],
    },
    {
      provide: StoryContentRepository,
      useFactory: (db: DbService) => new StoryContentRepository(db),
      inject: [DbService],
    },
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
      provide: SimpleJwtService,
      useFactory: () => new SimpleJwtService(),
    },
    {
      provide: AdminAccessService,
      useFactory: (repository: StoryPlatformRepository, jwtService: SimpleJwtService) =>
        new AdminAccessService(repository, jwtService),
      inject: [StoryPlatformRepository, SimpleJwtService],
    },
    {
      provide: StoryGroupSetService,
      useFactory: (
        repository: StoryContentRepository,
        publishResolutionService: PublishResolutionService,
        adminAccessService: AdminAccessService,
      ) => new StoryGroupSetService(repository, publishResolutionService, adminAccessService),
      inject: [StoryContentRepository, PublishResolutionService, AdminAccessService],
    },
  ],
})
export class StoryGroupSetModule {}
