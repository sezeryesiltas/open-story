import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetsRepository } from './assets.repository';

@Module({
  controllers: [AssetsController],
  providers: [DbService, AssetsService, AssetsRepository],
})
export class AssetsModule {}
