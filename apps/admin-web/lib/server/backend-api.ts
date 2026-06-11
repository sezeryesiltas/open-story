import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { ADMIN_AUTH_COOKIE_NAME } from './admin-auth-cookie.ts';
import { backendApiRequest, type BackendApiRequestOptions } from './backend-api-request.ts';

export { ADMIN_AUTH_COOKIE_NAME } from './admin-auth-cookie.ts';
export {
  BackendApiError,
  backendApiRequest,
  getBackendApiBaseUrl,
} from './backend-api-request.ts';

export function getAdminAuthTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getAdminAuthTokenFromCookies(): Promise<string | null> {
  return (await cookies()).get(ADMIN_AUTH_COOKIE_NAME)?.value ?? null;
}

export async function backendApiRequestFromRoute<T>(
  request: NextRequest,
  path: string,
  options: Omit<BackendApiRequestOptions, 'authToken'> = {},
): Promise<T> {
  return backendApiRequest<T>(path, {
    ...options,
    authToken: getAdminAuthTokenFromRequest(request),
  });
}
