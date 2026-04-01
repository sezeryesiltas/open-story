import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseSettingsDto, UpdateDatabaseSettingsDto } from '@open-story/contracts';
import { DbService } from '@open-story/db';

@Injectable()
export class SettingsService {
  constructor(private readonly db: DbService) {}

  getDatabaseSettings(): DatabaseSettingsDto {
    return this.db.getDatabaseSettings();
  }

  updateDatabaseSettings(payload: UpdateDatabaseSettingsDto): DatabaseSettingsDto {
    try {
      return this.db.updateDatabaseSettings(payload.externalDatabaseUrl);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Database ayarları güncellenemedi.',
      );
    }
  }
}
