import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import type { SdkFeedRequestDto, SdkFeedResponseDto } from '@open-story/contracts';
import { SdkFeedService } from './sdk-feed.service.ts';

@Controller('v1/sdk')
export class SdkFeedController {
  @Inject(SdkFeedService)
  private readonly service!: SdkFeedService;

  @Post('feed')
  async feed(
    @Body() payload: SdkFeedRequestDto,
    @Headers('authorization') authorization?: string,
  ): Promise<SdkFeedResponseDto> {
    return this.service.resolve(payload, authorization);
  }
}
