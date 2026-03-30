import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { StoryGroupSetController } from './story-group-set.controller';
import { StoryGroupSetService } from './story-group-set.service';
import { StoryGroupSetRepository } from './story-group-set.repository';

@Module({
  controllers: [StoryGroupSetController],
  providers: [DbService, StoryGroupSetService, StoryGroupSetRepository],
})
export class StoryGroupSetModule {}
