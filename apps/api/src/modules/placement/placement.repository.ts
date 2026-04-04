import { Inject, Injectable } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { PlacementDto } from '@open-story/contracts';

@Injectable()
export class PlacementRepository {
  private readonly db: DbService;

  constructor(@Inject(DbService) db: DbService) {
    this.db = db;
  }

  list(): PlacementDto[] {
    return this.db.list<PlacementDto>('placements');
  }

  findById(id: string): PlacementDto | undefined {
    return this.db.findById<PlacementDto>('placements', id);
  }

  findByKey(key: string): PlacementDto | undefined {
    return this.list().find((placement) => placement.key === key);
  }

  create(payload: PlacementDto): PlacementDto {
    return this.db.insert<PlacementDto>('placements', payload);
  }

  update(id: string, patch: Partial<PlacementDto>): PlacementDto | undefined {
    return this.db.updateById<PlacementDto>('placements', id, patch);
  }
}
