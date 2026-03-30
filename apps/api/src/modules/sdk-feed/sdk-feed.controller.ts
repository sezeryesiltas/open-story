import { Body, Controller, Headers, Post } from '@nestjs/common';
import { SdkFeedRequestDto, SdkFeedResponseDto } from '@open-story/contracts';
import { SdkFeedService } from './sdk-feed.service';

@Controller('v1/sdk')
export class SdkFeedController {
  constructor(private readonly service: SdkFeedService) {}

  @Post('feed')
  feed(
    @Body() payload: SdkFeedRequestDto,
    @Headers('authorization') authorization?: string,
  ): SdkFeedResponseDto {
    return this.service.resolve(payload, authorization);
  }
}
