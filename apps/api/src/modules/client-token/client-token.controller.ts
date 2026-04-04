import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import type {
  CreateStaticTokenDto,
  CreateStaticTokenResponseDto,
  RevokeStaticTokenDto,
  StaticTokenDto,
} from '@open-story/contracts';

import { ClientTokenService } from './client-token.service.ts';

@Controller('v1/client-tokens')
export class ClientTokenController {
  @Inject(ClientTokenService)
  private readonly service!: ClientTokenService;

  @Get()
  async list(@Headers('authorization') authorization?: string): Promise<StaticTokenDto[]> {
    return this.service.list(authorization);
  }

  @Post()
  async create(
    @Body() payload: CreateStaticTokenDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateStaticTokenResponseDto> {
    return this.service.create(payload, authorization);
  }

  @Post(':tokenId/revoke')
  async revoke(
    @Param('tokenId') tokenId: string,
    @Body() payload: RevokeStaticTokenDto,
    @Headers('authorization') authorization?: string,
  ): Promise<StaticTokenDto> {
    return this.service.revoke(tokenId, payload, authorization);
  }
}
