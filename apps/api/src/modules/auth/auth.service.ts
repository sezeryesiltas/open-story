import type {
  AuthChangePasswordDto,
  AuthLoginRequestDto,
  AuthLoginResponseDto,
  AuthSessionResponseDto,
} from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { AdminAuthService } from '../../admin-auth/admin-auth.service.ts';
import { verifyPassword } from '../../admin-auth/password.ts';
import { SimpleJwtService } from '../../admin-auth/simple-jwt.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { toAuthSessionDto, toAuthUserDto } from '../../story-platform/story-platform.mappers.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';

export class AuthService {
  private readonly adminAuthService: AdminAuthService;
  private readonly repository: StoryPlatformRepository;
  private readonly adminAccessService: AdminAccessService;

  constructor(
    repository: StoryPlatformRepository,
    jwtService: SimpleJwtService,
    adminAccessService = new AdminAccessService(repository, jwtService),
  ) {
    this.repository = repository;
    this.adminAccessService = adminAccessService;
    this.adminAuthService = new AdminAuthService(repository, repository, jwtService);
  }

  async login(payload: AuthLoginRequestDto): Promise<AuthLoginResponseDto> {
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password?.trim();

    if (!email || !password) {
      throw ApiServiceError.badRequest('Email and password are required.');
    }

    const result = await this.adminAuthService.signIn(email, password);
    if (!result.ok) {
      throw ApiServiceError.unauthorized(result.error.message);
    }

    const user = this.repository.findAdminUserById(result.session.userId);
    const session = this.repository.findAdminSessionById(result.session.id);

    if (!user || !session) {
      throw ApiServiceError.unauthorized('Failed to establish admin session.');
    }

    return {
      accessToken: result.accessToken,
      expiresIn: Math.max(0, Math.floor((result.session.expiresAt.getTime() - Date.now()) / 1000)),
      user: toAuthUserDto(user),
      session: toAuthSessionDto(session),
    };
  }

  async me(authorization?: string): Promise<AuthSessionResponseDto> {
    const { user, session } = await this.adminAccessService.requireAdminAccess(authorization);

    return {
      user: toAuthUserDto(user),
      session: toAuthSessionDto(session),
    };
  }

  async changePassword(
    payload: AuthChangePasswordDto,
    authorization?: string,
  ): Promise<AuthSessionResponseDto> {
    const { user, session } = await this.adminAccessService.requireAdminAccess(authorization);

    const currentPassword = payload.currentPassword?.trim();
    const newPassword = payload.newPassword?.trim();

    if (!currentPassword || !newPassword) {
      throw ApiServiceError.badRequest('Current and new password are required.');
    }

    if (newPassword.length < 8) {
      throw ApiServiceError.badRequest('New password must be at least 8 characters.');
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw ApiServiceError.unauthorized('Current password is incorrect.');
    }

    const updatedUser = this.repository.updateAdminUserPassword(user.id, newPassword, false);
    if (!updatedUser) {
      throw ApiServiceError.notFound('Admin user not found.');
    }

    return {
      user: toAuthUserDto(updatedUser),
      session: toAuthSessionDto(session),
    };
  }

  async logout(authorization?: string): Promise<void> {
    const { session } = await this.adminAccessService.requireAdminAccess(authorization);
    this.repository.revokeAdminSession(session.id);
  }
}
