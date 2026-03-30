import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { ClientTokenController } from './client-token.controller';
import { ClientTokenService } from './client-token.service';
import { ClientTokenRepository } from './client-token.repository';

@Module({
  controllers: [ClientTokenController],
  providers: [DbService, ClientTokenService, ClientTokenRepository],
})
export class ClientTokenModule {}
