import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import type {
  CreateStoryGroupSetDto,
  PublishStoryGroupSetDto,
  StoryGroupSetDto,
  UpdateStoryGroupSetDto,
} from '@open-story/contracts';

import { StoryGroupSetService } from './story-group-set.service';

@Controller('v1/story-group-sets')
export class StoryGroupSetController {
  constructor(private readonly service: StoryGroupSetService) {}

  @Get()
  async list(@Headers('authorization') authorization?: string): Promise<StoryGroupSetDto[]> {
    return this.service.list(authorization);
  }

  @Get(':setId')
  async get(
    @Param('setId') setId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupSetDto> {
    return this.service.get(setId, authorization);
  }

  @Post()
  async create(
    @Body() payload: CreateStoryGroupSetDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupSetDto> {
    return this.service.create(payload, authorization);
  }

  @Patch(':setId')
  async update(
    @Param('setId') setId: string,
    @Body() payload: UpdateStoryGroupSetDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupSetDto> {
    return this.service.update(setId, payload, authorization);
  }

  @Post(':setId/publish')
  async publish(
    @Param('setId') setId: string,
    @Body() payload: PublishStoryGroupSetDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupSetDto> {
    return this.service.publish(setId, payload, authorization);
  }
}
