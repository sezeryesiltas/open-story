import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateStaticTokenDto, RevokeStaticTokenDto, StaticTokenDto } from '@open-story/contracts';
import { randomUUID } from 'node:crypto';
import { ClientTokenRepository } from './client-token.repository';

@Injectable()
export class ClientTokenService {
  constructor(private readonly repository: ClientTokenRepository) {}

  create(payload: CreateStaticTokenDto): StaticTokenDto {
    if (!payload.label.trim()) {
      throw new ConflictException('Token label is required');
    }

    return this.repository.create({
      id: randomUUID(),
      label: payload.label,
      tokenPreview: 'tok_****',
      isActive: true,
    });
  }

  revoke(payload: RevokeStaticTokenDto): StaticTokenDto {
    const revoked = this.repository.revoke(payload.tokenId);
    if (!revoked) {
      throw new NotFoundException('Token not found');
    }

    return revoked;
  }
}
