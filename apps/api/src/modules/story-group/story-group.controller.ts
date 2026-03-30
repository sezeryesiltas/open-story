import { Body, Controller, Post } from '@nestjs/common';
import { CreateStoryGroupDto, StoryGroupDto } from '@open-story/contracts';
import { StoryGroupService } from './story-group.service';

@Controller('v1/story-groups')
export class StoryGroupController {
  constructor(private readonly service: StoryGroupService) {}

  @Post()
  create(@Body() payload: CreateStoryGroupDto): StoryGroupDto {
    return this.service.create(payload);
  }
}
