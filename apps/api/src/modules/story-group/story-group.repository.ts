import { Injectable } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { StoryGroupDto } from '@open-story/contracts';

@Injectable()
export class StoryGroupRepository {
  constructor(private readonly db: DbService) {}

  create(row: StoryGroupDto): StoryGroupDto {
    return this.db.insert<StoryGroupDto>('storyGroups', row);
  }
}
