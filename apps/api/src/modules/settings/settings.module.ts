import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../../admin-auth/simple-jwt.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';
import { AssetStorageSettingsStore } from './asset-storage-settings.store.ts';
import { SettingsController } from './settings.controller.ts';
import { SettingsService } from './settings.service.ts';

@Module({
  controllers: [SettingsController],
  providers: [
    DbService,
    AssetStorageSettingsStore,
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
      provide: SettingsService,
      useFactory: (
        db: DbService,
        adminAccessService: AdminAccessService,
        assetStorageSettingsStore: AssetStorageSettingsStore,
      ) => new SettingsService(db, adminAccessService, assetStorageSettingsStore),
      inject: [DbService, AdminAccessService, AssetStorageSettingsStore],
    },
  ],
})
export class SettingsModule {}
