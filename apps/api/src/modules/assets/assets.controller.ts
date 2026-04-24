import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AssetDto, AssetTypeDto, CreateAssetFromUrlDto } from '@open-story/contracts';

import { AssetsService } from './assets.service.ts';

type MultipartUploadFile = {
  originalname?: string;
  mimetype?: string;
  buffer?: Buffer;
};

@Controller('v1/assets')
export class AssetsController {
  @Inject(AssetsService)
  private readonly service!: AssetsService;

  @Get()
  async list(
    @Query('type') type?: AssetTypeDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AssetDto[]> {
    return this.service.list({ type }, authorization);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() uploadedFile?: MultipartUploadFile,
    @Body('type') typeValue?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<AssetDto> {
    if (!uploadedFile?.originalname || !uploadedFile.buffer || typeof typeValue !== 'string') {
      throw new BadRequestException('Multipart upload body `type` ve `file` alanlarını içermelidir.');
    }

    return this.service.upload(
      {
        type: typeValue as AssetTypeDto,
        fileName: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype ?? null,
        buffer: uploadedFile.buffer,
      },
      authorization,
    );
  }

  @Post('import')
  async importFromUrl(
    @Body() body?: Partial<CreateAssetFromUrlDto>,
    @Headers('authorization') authorization?: string,
  ): Promise<AssetDto> {
    if (typeof body?.type !== 'string' || typeof body?.url !== 'string') {
      throw new BadRequestException('JSON body `type` ve `url` alanlarını içermelidir.');
    }

    return this.service.importFromUrl(
      {
        type: body.type as AssetTypeDto,
        url: body.url,
      },
      authorization,
    );
  }

  @Delete(':assetId')
  @HttpCode(204)
  async delete(
    @Param('assetId') assetId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    await this.service.delete(assetId, authorization);
  }
}
