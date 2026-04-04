import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../../admin-auth/simple-jwt.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';
import { AssetsController } from './assets.controller.ts';
import { AssetsService } from './assets.service.ts';
import { AssetsRepository } from './assets.repository.ts';

@Module({
  controllers: [AssetsController],
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
      provide: AssetsRepository,
      useFactory: (db: DbService) => new AssetsRepository(db),
      inject: [DbService],
    },
    {
      provide: AssetsService,
      useFactory: (repository: AssetsRepository, adminAccessService: AdminAccessService) =>
        new AssetsService(repository, adminAccessService),
      inject: [AssetsRepository, AdminAccessService],
    },
  ],
})
export class AssetsModule {}
