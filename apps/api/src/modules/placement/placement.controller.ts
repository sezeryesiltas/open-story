import { Body, Controller, Get, Headers, Inject, Param, Post, Put } from '@nestjs/common';
import { CreatePlacementDto, PlacementDto, UpdatePlacementDto } from '@open-story/contracts';
import { PlacementService } from './placement.service.ts';

@Controller('v1/placements')
export class PlacementController {
  @Inject(PlacementService)
  private readonly service!: PlacementService;

  @Get()
  list(@Headers('authorization') authorization?: string): Promise<PlacementDto[]> {
    return this.service.list(authorization);
  }

  @Post()
  create(@Body() payload: CreatePlacementDto, @Headers('authorization') authorization?: string): Promise<PlacementDto> {
    return this.service.create(payload, authorization);
  }

  @Put(':placementId')
  update(
    @Param('placementId') placementId: string,
    @Body() payload: UpdatePlacementDto,
    @Headers('authorization') authorization?: string,
  ): Promise<PlacementDto> {
    return this.service.update(placementId, payload, authorization);
  }
}
