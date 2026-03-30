import { Body, Controller, Post } from '@nestjs/common';
import { CreateStoryDto, StoryDto } from '@open-story/contracts';
import { StoryService } from './story.service';

@Controller('v1/stories')
export class StoryController {
  constructor(private readonly service: StoryService) {}

  @Post()
  create(@Body() payload: CreateStoryDto): StoryDto {
    return this.service.create(payload);
  }
}
