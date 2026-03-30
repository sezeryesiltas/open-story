import { Body, Controller, Post } from '@nestjs/common';
import { AssetDto, CreateAssetDto } from '@open-story/contracts';
import { AssetsService } from './assets.service';

@Controller('v1/assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Post()
  create(@Body() payload: CreateAssetDto): AssetDto {
    return this.service.create(payload);
  }
}
