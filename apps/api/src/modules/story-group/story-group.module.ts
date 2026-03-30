import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { StoryGroupController } from './story-group.controller';
import { StoryGroupService } from './story-group.service';
import { StoryGroupRepository } from './story-group.repository';

@Module({
  controllers: [StoryGroupController],
  providers: [DbService, StoryGroupService, StoryGroupRepository],
})
export class StoryGroupModule {}
