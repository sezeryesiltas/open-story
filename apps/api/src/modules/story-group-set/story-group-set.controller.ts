import { Body, Controller, Post } from '@nestjs/common';
import { CreateStoryGroupSetDto, StoryGroupSetDto } from '@open-story/contracts';
import { StoryGroupSetService } from './story-group-set.service';

@Controller('v1/story-group-sets')
export class StoryGroupSetController {
  constructor(private readonly service: StoryGroupSetService) {}

  @Post()
  create(@Body() payload: CreateStoryGroupSetDto): StoryGroupSetDto {
    return this.service.create(payload);
  }
}
