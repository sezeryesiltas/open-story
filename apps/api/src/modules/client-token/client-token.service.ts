import { randomBytes } from 'node:crypto';

import { adminToken } from '@open-story/contracts';
import type {
  CreateStaticTokenDto,
  CreateStaticTokenResponseDto,
  RevokeStaticTokenDto,
  StaticTokenDto,
} from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { hashStaticToken } from '../../sdk-auth/static-token-hash.ts';
import { toStaticTokenDto } from '../../story-platform/story-platform.mappers.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';

export class ClientTokenService {
  private readonly repository: StoryPlatformRepository;
  private readonly adminAccessService: AdminAccessService;

  constructor(
    repository: StoryPlatformRepository,
    adminAccessService: AdminAccessService,
  ) {
    this.repository = repository;
    this.adminAccessService = adminAccessService;
  }

  async list(authorization?: string): Promise<StaticTokenDto[]> {
    await this.adminAccessService.requireAdminAccess(authorization);

    const client = this.repository.getSingletonClient();

    return this.repository
      .listStaticTokens()
      .map((token) => toStaticTokenDto(token, client.clientId));
  }

  async create(
    payload: CreateStaticTokenDto,
    authorization?: string,
  ): Promise<CreateStaticTokenResponseDto> {
    await this.adminAccessService.requireAdminAccess(authorization);

    const parsedPayload = adminToken.createStaticTokenDtoSchema.safeParse({
      label: payload.label,
    });

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Static token payload is invalid.');
    }

    const plainTextToken = createPlainTextToken();
    const tokenRecord = this.repository.createStaticToken({
      label: parsedPayload.data.label,
      tokenHash: hashStaticToken(plainTextToken),
      tokenPrefix: plainTextToken.slice(0, 12),
    });
    const client = this.repository.getSingletonClient();

    return {
      token: toStaticTokenDto(tokenRecord, client.clientId),
      plainTextToken,
    };
  }

  async revoke(
    tokenId: string,
    payload: RevokeStaticTokenDto,
    authorization?: string,
  ): Promise<StaticTokenDto> {
    await this.adminAccessService.requireAdminAccess(authorization);

    const parsedPayload = adminToken.revokeStaticTokenDtoSchema.safeParse({
      reason: payload.reason,
    });

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Revoke token payload is invalid.');
    }

    const revoked = this.repository.revokeStaticToken(tokenId);
    if (!revoked) {
      throw ApiServiceError.notFound('Static token not found.');
    }

    return toStaticTokenDto(revoked, this.repository.getSingletonClient().clientId);
  }
}

const createPlainTextToken = (): string => `ost_${randomBytes(24).toString('base64url')}`;
