import { adminClient } from '@open-story/contracts';
import type { ClientDto, UpdateClientDto } from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { toClientDto } from '../../story-platform/story-platform.mappers.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';

export class ClientService {
  private readonly repository: StoryPlatformRepository;
  private readonly adminAccessService: AdminAccessService;

  constructor(
    repository: StoryPlatformRepository,
    adminAccessService: AdminAccessService,
  ) {
    this.repository = repository;
    this.adminAccessService = adminAccessService;
  }

  async get(authorization?: string): Promise<ClientDto> {
    await this.adminAccessService.requireStoryEditorAccess(authorization);
    return toClientDto(this.repository.getSingletonClient());
  }

  async update(payload: UpdateClientDto, authorization?: string): Promise<ClientDto> {
    await this.adminAccessService.requireSuperAdminAccess(authorization);

    const parsedPayload = adminClient.updateClientDtoSchema.safeParse({
      name: payload.name,
      is_active: payload.isActive,
    });

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Client payload is invalid.');
    }

    if (parsedPayload.data.name === undefined && parsedPayload.data.is_active === undefined) {
      throw ApiServiceError.badRequest('At least one client field must be provided.');
    }

    return toClientDto(
      this.repository.updateSingletonClient({
        name: parsedPayload.data.name,
        isActive: parsedPayload.data.is_active,
      }),
    );
  }
}
