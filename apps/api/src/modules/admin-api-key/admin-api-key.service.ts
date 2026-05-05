import { randomUUID } from 'node:crypto';

import { adminApiKey } from '@open-story/contracts';
import type {
  AdminApiKeyDto,
  CreateAdminApiKeyDto,
  CreateAdminApiKeyResponseDto,
  RevokeAdminApiKeyDto,
} from '@open-story/contracts';

import {
  createAdminApiKey,
  createAdminApiKeyPrefix,
  createAdminClientSecret,
} from '../../admin-auth/admin-api-key.ts';
import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { hashStaticToken } from '../../sdk-auth/static-token-hash.ts';
import { toAdminApiKeyDto } from '../../story-platform/story-platform.mappers.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';

export class AdminApiKeyService {
  private readonly repository: StoryPlatformRepository;
  private readonly adminAccessService: AdminAccessService;

  constructor(
    repository: StoryPlatformRepository,
    adminAccessService: AdminAccessService,
  ) {
    this.repository = repository;
    this.adminAccessService = adminAccessService;
  }

  async list(authorization?: string): Promise<AdminApiKeyDto[]> {
    await this.adminAccessService.requireSuperAdminSession(authorization);

    return this.repository.listAdminApiKeys().map(toAdminApiKeyDto);
  }

  async create(
    payload: CreateAdminApiKeyDto,
    authorization?: string,
  ): Promise<CreateAdminApiKeyResponseDto> {
    const { user } = await this.adminAccessService.requireSuperAdminSession(authorization);
    const parsedPayload = adminApiKey.createAdminApiKeyDtoSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Admin API key payload is invalid.');
    }

    const keyId = randomUUID();
    const clientSecret = createAdminClientSecret();
    const plainTextApiKey = createAdminApiKey(keyId, clientSecret);
    const record = this.repository.createAdminApiKey({
      id: keyId,
      clientName: parsedPayload.data.clientName,
      keyPrefix: createAdminApiKeyPrefix(keyId),
      clientSecretHash: hashStaticToken(clientSecret),
      createdByAdminUserId: user.id,
    });

    return {
      apiKey: toAdminApiKeyDto(record),
      plainTextApiKey,
      clientSecret,
    };
  }

  async revoke(
    keyId: string,
    payload: RevokeAdminApiKeyDto,
    authorization?: string,
  ): Promise<AdminApiKeyDto> {
    await this.adminAccessService.requireSuperAdminSession(authorization);

    const parsedPayload = adminApiKey.revokeAdminApiKeyDtoSchema.safeParse({
      reason: payload.reason,
    });

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Revoke API key payload is invalid.');
    }

    const revoked = this.repository.revokeAdminApiKey(keyId);
    if (!revoked) {
      throw ApiServiceError.notFound('Admin API key not found.');
    }

    return toAdminApiKeyDto(revoked);
  }
}
