import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { PlacementController } from './placement.controller.ts';
import { PlacementService } from './placement.service.ts';
import { PlacementRepository } from './placement.repository.ts';

@Module({
  controllers: [PlacementController],
  providers: [
    DbService,
    {
      provide: PlacementRepository,
      useFactory: (db: DbService) => new PlacementRepository(db),
      inject: [DbService],
    },
    {
      provide: PlacementService,
      useFactory: (repository: PlacementRepository) => new PlacementService(repository),
      inject: [PlacementRepository],
    },
  ],
})
export class PlacementModule {}
