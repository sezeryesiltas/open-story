import { Body, Controller, Get, Headers, Inject, Post, Put } from '@nestjs/common';
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
  getDatabaseSettings(@Headers('authorization') authorization?: string): Promise<DatabaseSettingsDto> {
    return this.service.getDatabaseSettings(authorization);
  }

  @Put('database')
  updateDatabaseSettings(
    @Body() payload: UpdateDatabaseSettingsDto,
    @Headers('authorization') authorization?: string,
  ): Promise<DatabaseSettingsDto> {
    return this.service.updateDatabaseSettings(payload, authorization);
  }

  @Post('database/test')
  testDatabaseConnection(
    @Body() payload: TestDatabaseConnectionDto,
    @Headers('authorization') authorization?: string,
  ): Promise<TestDatabaseConnectionResponseDto> {
    return this.service.testDatabaseConnection(payload, authorization);
  }

  @Get('storage')
  getAssetStorageSettings(@Headers('authorization') authorization?: string): Promise<AssetStorageSettingsDto> {
    return this.service.getAssetStorageSettings(authorization);
  }

  @Put('storage')
  updateAssetStorageSettings(
    @Body() payload: UpdateAssetStorageSettingsDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AssetStorageSettingsDto> {
    return this.service.updateAssetStorageSettings(payload, authorization);
  }

  @Post('storage/test')
  testAssetStorageConnection(
    @Body() payload: TestAssetStorageSettingsDto,
    @Headers('authorization') authorization?: string,
  ): Promise<TestAssetStorageConnectionResponseDto> {
    return this.service.testAssetStorageConnection(payload, authorization);
  }
}
