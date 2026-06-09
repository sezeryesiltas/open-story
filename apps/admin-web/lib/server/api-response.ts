import { NextResponse } from 'next/server';

import {
  ADMIN_AUTH_COOKIE_NAME,
  getExpiredAdminAuthCookieOptions,
  shouldExpireAdminAuthCookie,
} from './admin-auth-cookie';

export function expireAdminAuthCookie(response: NextResponse) {
  response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', getExpiredAdminAuthCookieOptions());

  return response;
}

export function jsonError(message: string, status: number, code: string) {
  const response = NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );

  if (shouldExpireAdminAuthCookie(status)) {
    expireAdminAuthCookie(response);
  }

  return response;
}
