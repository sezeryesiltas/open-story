import type {
  AuthChangePasswordDto,
  AuthLoginRequestDto,
  AuthLoginResponseDto,
  AuthSessionResponseDto,
} from '@open-story/contracts';

import { backendApiRequest, BackendApiError } from './backend-api';

export function mapApiServiceError(error: unknown): {
  status: number;
  code: string;
  message: string;
} | null {
  if (!(error instanceof BackendApiError)) {
    return null;
  }

  return {
    status: error.status,
    code: error.code ?? 'validation_error',
    message: error.message,
  };
}

export async function loginAdmin(payload: AuthLoginRequestDto): Promise<AuthLoginResponseDto> {
  return backendApiRequest<AuthLoginResponseDto>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAdminSessionFromToken(token: string): Promise<AuthSessionResponseDto> {
  return backendApiRequest<AuthSessionResponseDto>('/v1/auth/me', {
    authToken: token,
  });
}

export async function changeAdminPasswordFromToken(
  token: string,
  payload: AuthChangePasswordDto,
): Promise<AuthSessionResponseDto> {
  return backendApiRequest<AuthSessionResponseDto>('/v1/auth/change-password', {
    method: 'POST',
    authToken: token,
    body: JSON.stringify(payload),
  });
}

export async function logoutAdminFromToken(token: string): Promise<void> {
  await backendApiRequest<void>('/v1/auth/logout', {
    method: 'POST',
    authToken: token,
  });
}
