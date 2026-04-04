import { Body, Controller, Get, Headers, Inject, Param, Patch, Post } from '@nestjs/common';
import type {
  ArchiveStoryGroupDto,
  CreateStoryGroupDto,
  PublishStoryGroupDto,
  StoryGroupDto,
  UpdateStoryGroupDto,
} from '@open-story/contracts';

import { StoryGroupService } from './story-group.service.ts';

@Controller('v1/story-groups')
export class StoryGroupController {
  @Inject(StoryGroupService)
  private readonly service!: StoryGroupService;

  @Get()
  async list(@Headers('authorization') authorization?: string): Promise<StoryGroupDto[]> {
    return this.service.list(authorization);
  }

  @Get(':groupId')
  async get(
    @Param('groupId') groupId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupDto> {
    return this.service.get(groupId, authorization);
  }

  @Post()
  async create(
    @Body() payload: CreateStoryGroupDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupDto> {
    return this.service.create(payload, authorization);
  }

  @Patch(':groupId')
  async update(
    @Param('groupId') groupId: string,
    @Body() payload: UpdateStoryGroupDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupDto> {
    return this.service.update(groupId, payload, authorization);
  }

  @Post(':groupId/publish')
  async publish(
    @Param('groupId') groupId: string,
    @Body() payload: PublishStoryGroupDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupDto> {
    return this.service.publish(groupId, payload, authorization);
  }

  @Post(':groupId/archive')
  async archive(
    @Param('groupId') groupId: string,
    @Body() payload: ArchiveStoryGroupDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StoryGroupDto> {
    return this.service.archive(groupId, payload, authorization);
  }
}
