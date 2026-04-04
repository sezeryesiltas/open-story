import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../../admin-auth/simple-jwt.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';
import { AdminUserController } from './admin-user.controller.ts';
import { AdminUserService } from './admin-user.service.ts';

@Module({
  controllers: [AdminUserController],
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
      provide: AdminUserService,
      useFactory: (repository: StoryPlatformRepository, adminAccessService: AdminAccessService) =>
        new AdminUserService(repository, adminAccessService),
      inject: [StoryPlatformRepository, AdminAccessService],
    },
  ],
})
export class AdminUserModule {}
