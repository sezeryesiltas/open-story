import { Injectable } from '@nestjs/common';
import { CreateStoryGroupSetDto, StoryGroupSetDto } from '@open-story/contracts';
import { randomUUID } from 'node:crypto';
import { StoryGroupSetRepository } from './story-group-set.repository';

@Injectable()
export class StoryGroupSetService {
  constructor(private readonly repository: StoryGroupSetRepository) {}

  create(payload: CreateStoryGroupSetDto): StoryGroupSetDto {
    return this.repository.create({
      id: randomUUID(),
      placementId: payload.placementId,
      name: payload.name,
      isFallback: payload.isFallback,
    });
  }
}
