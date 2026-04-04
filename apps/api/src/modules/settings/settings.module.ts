import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { SettingsController } from './settings.controller.ts';
import { SettingsService } from './settings.service.ts';

@Module({
  controllers: [SettingsController],
  providers: [
    DbService,
    {
      provide: SettingsService,
      useFactory: (db: DbService) => new SettingsService(db),
      inject: [DbService],
    },
  ],
})
export class SettingsModule {}
