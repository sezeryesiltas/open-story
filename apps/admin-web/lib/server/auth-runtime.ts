import { DbService } from '@open-story/db';
import type { AuthChangePasswordDto, AuthLoginRequestDto, AuthLoginResponseDto, AuthSessionResponseDto } from '@open-story/contracts';

import { AdminAccessService } from '../../../api/src/admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../../../api/src/admin-auth/simple-jwt.ts';
import { ApiServiceError } from '../../../api/src/common/filters/api-error.ts';
import { AuthService } from '../../../api/src/modules/auth/auth.service.ts';
import { StoryPlatformRepository } from '../../../api/src/story-platform/story-platform.repository.ts';

const db = new DbService();
const repository = new StoryPlatformRepository(db);
const jwtService = new SimpleJwtService();
const adminAccessService = new AdminAccessService(repository, jwtService);
const authService = new AuthService(repository, jwtService, adminAccessService);

export function mapApiServiceError(error: unknown): {
  status: number;
  code: string;
  message: string;
} | null {
  if (!(error instanceof ApiServiceError)) {
    return null;
  }

  return {
    status: error.statusCode,
    code: error.code,
    message: error.message,
  };
}

export async function loginAdmin(payload: AuthLoginRequestDto): Promise<AuthLoginResponseDto> {
  return authService.login(payload);
}

export async function getAdminSessionFromToken(token: string): Promise<AuthSessionResponseDto> {
  return authService.me(`Bearer ${token}`);
}

export async function changeAdminPasswordFromToken(
  token: string,
  payload: AuthChangePasswordDto,
): Promise<AuthSessionResponseDto> {
  return authService.changePassword(payload, `Bearer ${token}`);
}

export async function logoutAdminFromToken(token: string): Promise<void> {
  await authService.logout(`Bearer ${token}`);
}
