import { Body, Controller, Get, Headers, Inject, Patch } from '@nestjs/common';
import type { ClientDto, UpdateClientDto } from '@open-story/contracts';

import { ClientService } from './client.service.ts';

@Controller('v1/client')
export class ClientController {
  @Inject(ClientService)
  private readonly clientService!: ClientService;

  @Get()
  async get(@Headers('authorization') authorization?: string): Promise<ClientDto> {
    return this.clientService.get(authorization);
  }

  @Patch()
  async update(
    @Body() payload: UpdateClientDto,
    @Headers('authorization') authorization?: string,
  ): Promise<ClientDto> {
    return this.clientService.update(payload, authorization);
  }
}
