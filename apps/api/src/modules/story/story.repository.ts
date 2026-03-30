import { Injectable } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { StoryDto } from '@open-story/contracts';

@Injectable()
export class StoryRepository {
  constructor(private readonly db: DbService) {}

  create(row: StoryDto): StoryDto {
    return this.db.insert<StoryDto>('stories', row);
  }
}
