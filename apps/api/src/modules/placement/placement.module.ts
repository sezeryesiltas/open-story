import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { PlacementController } from './placement.controller';
import { PlacementService } from './placement.service';
import { PlacementRepository } from './placement.repository';

@Module({
  controllers: [PlacementController],
  providers: [DbService, PlacementService, PlacementRepository],
})
export class PlacementModule {}
