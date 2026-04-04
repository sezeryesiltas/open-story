import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { CreatePlacementDto, PlacementDto, UpdatePlacementDto } from '@open-story/contracts';
import { PlacementService } from './placement.service.ts';

@Controller('v1/placements')
export class PlacementController {
  @Inject(PlacementService)
  private readonly service!: PlacementService;

  @Get()
  list(): PlacementDto[] {
    return this.service.list();
  }

  @Post()
  create(@Body() payload: CreatePlacementDto): PlacementDto {
    return this.service.create(payload);
  }

  @Put(':placementId')
  update(@Param('placementId') placementId: string, @Body() payload: UpdatePlacementDto): PlacementDto {
    return this.service.update(placementId, payload);
  }
}
