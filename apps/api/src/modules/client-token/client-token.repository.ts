import { Injectable } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { StaticTokenDto } from '@open-story/contracts';

@Injectable()
export class ClientTokenRepository {
  constructor(private readonly db: DbService) {}

  create(token: StaticTokenDto): StaticTokenDto {
    return this.db.insert<StaticTokenDto>('staticTokens', token);
  }

  revoke(tokenId: string): StaticTokenDto | undefined {
    return this.db.updateById<StaticTokenDto>('staticTokens', tokenId, { isActive: false });
  }
}
