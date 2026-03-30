import { ConflictException, Injectable } from '@nestjs/common';
import { CreatePlacementDto, PlacementDto } from '@open-story/contracts';
import { randomUUID } from 'node:crypto';
import { PlacementRepository } from './placement.repository';

@Injectable()
export class PlacementService {
  constructor(private readonly repository: PlacementRepository) {}

  create(payload: CreatePlacementDto): PlacementDto {
    if (!payload.key.trim()) {
      throw new ConflictException('placement key is required');
    }

    return this.repository.create({
      id: randomUUID(),
      key: payload.key,
      name: payload.name,
    });
  }
}
