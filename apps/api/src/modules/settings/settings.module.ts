import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { AssetStorageSettingsStore } from './asset-storage-settings.store.ts';
import { SettingsController } from './settings.controller.ts';
import { SettingsService } from './settings.service.ts';

@Module({
  controllers: [SettingsController],
  providers: [
    DbService,
    AssetStorageSettingsStore,
    {
      provide: SettingsService,
      useFactory: (db: DbService, assetStorageSettingsStore: AssetStorageSettingsStore) =>
        new SettingsService(db, assetStorageSettingsStore),
      inject: [DbService, AssetStorageSettingsStore],
    },
  ],
})
export class SettingsModule {}
