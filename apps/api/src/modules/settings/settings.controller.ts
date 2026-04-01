import { Body, Controller, Get, Put } from '@nestjs/common';
import { DatabaseSettingsDto, UpdateDatabaseSettingsDto } from '@open-story/contracts';
import { SettingsService } from './settings.service';

@Controller('v1/settings/database')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  getDatabaseSettings(): DatabaseSettingsDto {
    return this.service.getDatabaseSettings();
  }

  @Put()
  updateDatabaseSettings(@Body() payload: UpdateDatabaseSettingsDto): DatabaseSettingsDto {
    return this.service.updateDatabaseSettings(payload);
  }
}
