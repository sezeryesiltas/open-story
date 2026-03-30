import { Injectable } from '@nestjs/common';
import { AssetDto, CreateAssetDto } from '@open-story/contracts';
import { randomUUID } from 'node:crypto';
import { AssetsRepository } from './assets.repository';

@Injectable()
export class AssetsService {
  constructor(private readonly repository: AssetsRepository) {}

  create(payload: CreateAssetDto): AssetDto {
    return this.repository.create({
      id: randomUUID(),
      type: payload.type,
      url: payload.url,
    });
  }
}
