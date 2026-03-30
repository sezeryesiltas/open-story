import { Body, Controller, Post } from '@nestjs/common';
import { CreateStaticTokenDto, RevokeStaticTokenDto, StaticTokenDto } from '@open-story/contracts';
import { ClientTokenService } from './client-token.service';

@Controller('v1/client-tokens')
export class ClientTokenController {
  constructor(private readonly service: ClientTokenService) {}

  @Post()
  create(@Body() payload: CreateStaticTokenDto): StaticTokenDto {
    return this.service.create(payload);
  }

  @Post('revoke')
  revoke(@Body() payload: RevokeStaticTokenDto): StaticTokenDto {
    return this.service.revoke(payload);
  }
}
