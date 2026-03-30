import { Injectable } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { StoryGroupSetDto } from '@open-story/contracts';

@Injectable()
export class StoryGroupSetRepository {
  constructor(private readonly db: DbService) {}

  create(row: StoryGroupSetDto): StoryGroupSetDto {
    return this.db.insert<StoryGroupSetDto>('storyGroupSets', row);
  }
}
