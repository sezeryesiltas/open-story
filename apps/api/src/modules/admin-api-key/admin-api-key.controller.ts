import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import type {
  AdminApiKeyDto,
  CreateAdminApiKeyDto,
  CreateAdminApiKeyResponseDto,
  RevokeAdminApiKeyDto,
} from '@open-story/contracts';

import { AdminApiKeyService } from './admin-api-key.service.ts';

@Controller('v1/admin-api-keys')
export class AdminApiKeyController {
  @Inject(AdminApiKeyService)
  private readonly service!: AdminApiKeyService;

  @Get()
  async list(@Headers('authorization') authorization?: string): Promise<AdminApiKeyDto[]> {
    return this.service.list(authorization);
  }

  @Post()
  async create(
    @Body() payload: CreateAdminApiKeyDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateAdminApiKeyResponseDto> {
    return this.service.create(payload, authorization);
  }

  @Post(':keyId/revoke')
  async revoke(
    @Param('keyId') keyId: string,
    @Body() payload: RevokeAdminApiKeyDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AdminApiKeyDto> {
    return this.service.revoke(keyId, payload, authorization);
  }
}
