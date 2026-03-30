import { Injectable } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { AssetDto } from '@open-story/contracts';

@Injectable()
export class AssetsRepository {
  constructor(private readonly db: DbService) {}

  create(row: AssetDto): AssetDto {
    return this.db.insert<AssetDto>('assets', row);
  }
}
