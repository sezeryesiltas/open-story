import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../../admin-auth/simple-jwt.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';
import { AdminApiKeyController } from './admin-api-key.controller.ts';
import { AdminApiKeyService } from './admin-api-key.service.ts';

@Module({
  controllers: [AdminApiKeyController],
  providers: [
    DbService,
    {
      provide: StoryPlatformRepository,
      useFactory: (db: DbService) => new StoryPlatformRepository(db),
      inject: [DbService],
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
      provide: AdminApiKeyService,
      useFactory: (repository: StoryPlatformRepository, adminAccessService: AdminAccessService) =>
        new AdminApiKeyService(repository, adminAccessService),
      inject: [StoryPlatformRepository, AdminAccessService],
    },
  ],
})
export class AdminApiKeyModule {}
