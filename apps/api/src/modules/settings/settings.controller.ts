import { Body, Controller, Get, Inject, Post, Put } from '@nestjs/common';
import {
  AssetStorageSettingsDto,
  DatabaseSettingsDto,
  TestAssetStorageConnectionResponseDto,
  TestAssetStorageSettingsDto,
  TestDatabaseConnectionDto,
  TestDatabaseConnectionResponseDto,
  UpdateAssetStorageSettingsDto,
  UpdateDatabaseSettingsDto,
} from '@open-story/contracts';
import { SettingsService } from './settings.service.ts';

@Controller('v1/settings')
export class SettingsController {
  @Inject(SettingsService)
  private readonly service!: SettingsService;

  @Get('database')
  getDatabaseSettings(): DatabaseSettingsDto {
    return this.service.getDatabaseSettings();
  }

  @Put('database')
  updateDatabaseSettings(@Body() payload: UpdateDatabaseSettingsDto): DatabaseSettingsDto {
    return this.service.updateDatabaseSettings(payload);
  }

  @Post('database/test')
  testDatabaseConnection(@Body() payload: TestDatabaseConnectionDto): TestDatabaseConnectionResponseDto {
    return this.service.testDatabaseConnection(payload);
  }

  @Get('storage')
  getAssetStorageSettings(): AssetStorageSettingsDto {
    return this.service.getAssetStorageSettings();
  }

  @Put('storage')
  updateAssetStorageSettings(@Body() payload: UpdateAssetStorageSettingsDto): AssetStorageSettingsDto {
    return this.service.updateAssetStorageSettings(payload);
  }

  @Post('storage/test')
  testAssetStorageConnection(
    @Body() payload: TestAssetStorageSettingsDto,
  ): Promise<TestAssetStorageConnectionResponseDto> {
    return this.service.testAssetStorageConnection(payload);
  }
}
