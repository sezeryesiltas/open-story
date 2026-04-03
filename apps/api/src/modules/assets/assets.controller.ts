import { BadRequestException, Controller, Get, Headers, Post, Query, Req } from '@nestjs/common';
import type { AssetDto, AssetTypeDto } from '@open-story/contracts';

import { AssetsService } from './assets.service.ts';

type MultipartUploadPart = {
  filename?: string;
  mimetype?: string;
  toBuffer?: () => Promise<Buffer>;
};

type MultipartUploadRequest = {
  body?: {
    type?: unknown;
  };
  file?: () => Promise<MultipartUploadPart | undefined>;
};

@Controller('v1/assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  async list(
    @Query('type') type?: AssetTypeDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AssetDto[]> {
    return this.service.list({ type }, authorization);
  }

  @Post('upload')
  async upload(
    @Req() request?: MultipartUploadRequest,
    @Headers('authorization') authorization?: string,
  ): Promise<AssetDto> {
    const uploadedFile = request?.file ? await request.file() : undefined;
    const typeValue = request?.body?.type;

    if (!uploadedFile?.filename || !uploadedFile.toBuffer || typeof typeValue !== 'string') {
      throw new BadRequestException('Multipart upload body `type` ve `file` alanlarını içermelidir.');
    }

    return this.service.upload(
      {
        type: typeValue as AssetTypeDto,
        fileName: uploadedFile.filename,
        mimeType: uploadedFile.mimetype ?? null,
        buffer: await uploadedFile.toBuffer(),
      },
      authorization,
    );
  }
}
