import type { AssetRecord } from '@open-story/contracts';
import { DbService } from '@open-story/db';

export class AssetsRepository {
  private readonly db: DbService;

  constructor(db: DbService) {
    this.db = db;
  }

  list(): AssetRecord[] {
    return this.db
      .list<AssetRecord>('assets')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  create(row: AssetRecord): AssetRecord {
    return this.db.insert<AssetRecord>('assets', row);
  }
}
