import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [DbService, SettingsService],
})
export class SettingsModule {}
