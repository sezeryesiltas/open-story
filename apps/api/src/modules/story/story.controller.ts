import { Body, Controller, Get, Headers, Inject, Param, Patch, Post } from '@nestjs/common';
import type {
  ArchiveStoryDto,
  CreateStoryDto,
  MoveStoryDto,
  PublishStoryDto,
  StoryDto,
  UpdateStoryDto,
} from '@open-story/contracts';

import { StoryService } from './story.service.ts';

@Controller('v1/stories')
export class StoryController {
  @Inject(StoryService)
  private readonly service!: StoryService;

  @Get()
  async list(@Headers('authorization') authorization?: string): Promise<StoryDto[]> {
    return this.service.list(authorization);
  }

  @Get(':storyId')
  async get(
    @Param('storyId') storyId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryDto> {
    return this.service.get(storyId, authorization);
  }

  @Post()
  async create(
    @Body() payload: CreateStoryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryDto> {
    return this.service.create(payload, authorization);
  }

  @Patch(':storyId')
  async update(
    @Param('storyId') storyId: string,
    @Body() payload: UpdateStoryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryDto> {
    return this.service.update(storyId, payload, authorization);
  }

  @Post(':storyId/move')
  async move(
    @Param('storyId') storyId: string,
    @Body() payload: MoveStoryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryDto> {
    return this.service.move(storyId, payload, authorization);
  }

  @Post(':storyId/publish')
  async publish(
    @Param('storyId') storyId: string,
    @Body() payload: PublishStoryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryDto> {
    return this.service.publish(storyId, payload, authorization);
  }

  @Post(':storyId/archive')
  async archive(
    @Param('storyId') storyId: string,
    @Body() payload: ArchiveStoryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryDto> {
    return this.service.archive(storyId, payload, authorization);
  }
}
