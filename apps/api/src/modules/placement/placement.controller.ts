import { Body, Controller, Post } from '@nestjs/common';
import { CreatePlacementDto, PlacementDto } from '@open-story/contracts';
import { PlacementService } from './placement.service';

@Controller('v1/placements')
export class PlacementController {
  constructor(private readonly service: PlacementService) {}

  @Post()
  create(@Body() payload: CreatePlacementDto): PlacementDto {
    return this.service.create(payload);
  }
}
