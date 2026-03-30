import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { StoryRepository } from './story.repository';

@Module({
  controllers: [StoryController],
  providers: [DbService, StoryService, StoryRepository],
})
export class StoryModule {}
