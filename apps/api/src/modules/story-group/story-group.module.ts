import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { AdminAccessService } from '../../admin-auth/admin-access.service';
import { SimpleJwtService } from '../../admin-auth/simple-jwt';
import { PublishResolutionRepository } from '../../publish/publish-resolution.repository';
import { PublishResolutionService } from '../../publish/publish-resolution.service';
import { StoryContentRepository } from '../../story-content/story-content.repository';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository';
import { StoryGroupController } from './story-group.controller';
import { StoryGroupService } from './story-group.service';

@Module({
  controllers: [StoryGroupController],
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
      provide: StoryGroupService,
      useFactory: (
        repository: StoryContentRepository,
        publishResolutionService: PublishResolutionService,
        adminAccessService: AdminAccessService,
      ) => new StoryGroupService(repository, publishResolutionService, adminAccessService),
      inject: [StoryContentRepository, PublishResolutionService, AdminAccessService],
    },
  ],
})
export class StoryGroupModule {}
