import { Injectable } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { PlacementDto } from '@open-story/contracts';

@Injectable()
export class PlacementRepository {
  constructor(private readonly db: DbService) {}

  create(payload: PlacementDto): PlacementDto {
    return this.db.insert<PlacementDto>('placements', payload);
  }
}
