import { Injectable } from '@nestjs/common';
import { CreateStoryGroupDto, StoryGroupDto } from '@open-story/contracts';
import { randomUUID } from 'node:crypto';
import { StoryGroupRepository } from './story-group.repository';

@Injectable()
export class StoryGroupService {
  constructor(private readonly repository: StoryGroupRepository) {}

  create(payload: CreateStoryGroupDto): StoryGroupDto {
    return this.repository.create({
      id: randomUUID(),
      title: payload.title,
      isArchived: false,
    });
  }
}
