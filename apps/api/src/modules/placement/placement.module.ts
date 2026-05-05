import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../../admin-auth/simple-jwt.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';
import { PlacementController } from './placement.controller.ts';
import { PlacementService } from './placement.service.ts';
import { PlacementRepository } from './placement.repository.ts';

@Module({
  controllers: [PlacementController],
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
      provide: PlacementRepository,
      useFactory: (db: DbService) => new PlacementRepository(db),
      inject: [DbService],
    },
    {
      provide: PlacementService,
      useFactory: (repository: PlacementRepository, adminAccessService: AdminAccessService) =>
        new PlacementService(repository, adminAccessService),
      inject: [PlacementRepository, AdminAccessService],
    },
  ],
})
export class PlacementModule {}
