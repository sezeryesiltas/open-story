import type { AuthSessionResponseDto } from '@open-story/contracts';
import { redirect } from 'next/navigation';

import { canAdminRoleAccessPath } from '../admin-authorization';
import { getAdminAuthTokenFromCookies } from './backend-api';
import { getAdminSessionFromToken, mapApiServiceError } from './auth-runtime';

export async function getAdminSession(): Promise<AuthSessionResponseDto | null> {
  const token = await getAdminAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    return await getAdminSessionFromToken(token);
  } catch (error) {
    const mappedError = mapApiServiceError(error);
    if (mappedError && (mappedError.status === 401 || mappedError.status === 403)) {
      return null;
    }

    throw error;
  }
}

export async function requireConsoleSession(): Promise<AuthSessionResponseDto> {
  const session = await getAdminSession();
  if (!session) {
    redirect('/login');
  }

  if (session.user.mustChangePassword) {
    redirect('/change-password');
  }

  return session;
}

export async function requireAdminPageAccess(path: string): Promise<AuthSessionResponseDto> {
  const session = await requireConsoleSession();
  if (!canAdminRoleAccessPath(session.user.role, path)) {
    redirect('/');
  }

  return session;
}

export async function redirectAuthenticatedAwayFromAuthPage(): Promise<void> {
  const session = await getAdminSession();
  if (!session) {
    return;
  }

  if (session.user.mustChangePassword) {
    redirect('/change-password');
  }

  redirect('/');
}
