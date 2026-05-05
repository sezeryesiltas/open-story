import { adminUser } from '@open-story/contracts';
import type {
  AdminUserDto,
  CreateAdminUserDto,
  ResetAdminUserPasswordDto,
  UpdateAdminUserRoleDto,
} from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { toAdminUserDto } from '../../story-platform/story-platform.mappers.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';

export class AdminUserService {
  private readonly repository: StoryPlatformRepository;
  private readonly adminAccessService: AdminAccessService;

  constructor(
    repository: StoryPlatformRepository,
    adminAccessService: AdminAccessService,
  ) {
    this.repository = repository;
    this.adminAccessService = adminAccessService;
  }

  async list(authorization?: string): Promise<AdminUserDto[]> {
    await this.adminAccessService.requireSuperAdminAccess(authorization);
    return this.repository.listAdminUsers().map(toAdminUserDto);
  }

  async create(payload: CreateAdminUserDto, authorization?: string): Promise<AdminUserDto> {
    await this.adminAccessService.requireSuperAdminAccess(authorization);

    const parsedPayload = adminUser.createAdminUserDtoSchema.safeParse({
      email: payload.email,
      role: payload.role,
      temporary_password: payload.temporaryPassword,
    });

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Admin user payload is invalid.');
    }

    const existingUser = this.repository.findAdminUserByEmail(parsedPayload.data.email);
    if (existingUser) {
      throw ApiServiceError.conflict('Admin user email already exists.');
    }

    const createdUser = this.repository.createAdminUser({
      email: parsedPayload.data.email,
      role: parsedPayload.data.role,
      temporaryPassword: parsedPayload.data.temporary_password,
    });

    return toAdminUserDto(createdUser);
  }

  async resetPassword(
    userId: string,
    payload: ResetAdminUserPasswordDto,
    authorization?: string,
  ): Promise<AdminUserDto> {
    await this.adminAccessService.requireSuperAdminAccess(authorization);

    const parsedPayload = adminUser.resetAdminUserPasswordDtoSchema.safeParse({
      temporary_password: payload.temporaryPassword,
    });

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Reset password payload is invalid.');
    }

    const existingUser = this.repository.findAdminUserById(userId);
    if (!existingUser) {
      throw ApiServiceError.notFound('Admin user not found.');
    }

    const updatedUser = this.repository.updateAdminUserPassword(
      userId,
      parsedPayload.data.temporary_password,
      true,
    );

    if (!updatedUser) {
      throw ApiServiceError.notFound('Admin user not found.');
    }

    return toAdminUserDto(updatedUser);
  }

  async updateRole(
    userId: string,
    payload: UpdateAdminUserRoleDto,
    authorization?: string,
  ): Promise<AdminUserDto> {
    const access = await this.adminAccessService.requireSuperAdminSession(authorization);

    if (userId === access.user.id) {
      throw ApiServiceError.forbidden('Super Admin cannot change their own role.');
    }

    const parsedPayload = adminUser.updateAdminUserRoleDtoSchema.safeParse({
      role: payload.role,
    });

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Admin user role payload is invalid.');
    }

    const existingUser = this.repository.findAdminUserById(userId);
    if (!existingUser) {
      throw ApiServiceError.notFound('Admin user not found.');
    }

    const updatedUser = this.repository.updateAdminUserRole(userId, parsedPayload.data.role);
    if (!updatedUser) {
      throw ApiServiceError.notFound('Admin user not found.');
    }

    return toAdminUserDto(updatedUser);
  }
}
