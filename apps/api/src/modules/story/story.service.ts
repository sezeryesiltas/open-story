import { Injectable } from '@nestjs/common';
import { CreateStoryDto, StoryDto } from '@open-story/contracts';
import { randomUUID } from 'node:crypto';
import { StoryRepository } from './story.repository';

@Injectable()
export class StoryService {
  constructor(private readonly repository: StoryRepository) {}

  create(payload: CreateStoryDto): StoryDto {
    return this.repository.create({
      id: randomUUID(),
      storyGroupId: payload.storyGroupId,
      mediaType: payload.mediaType,
      isArchived: false,
    });
  }
}
