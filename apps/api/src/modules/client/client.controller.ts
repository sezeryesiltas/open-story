import { Body, Controller, Get, Headers, Patch } from '@nestjs/common';
import type { ClientDto, UpdateClientDto } from '@open-story/contracts';

import { ClientService } from './client.service';

@Controller('v1/client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

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
