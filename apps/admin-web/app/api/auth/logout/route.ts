import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { ADMIN_AUTH_COOKIE_NAME, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';
import { logoutAdminFromToken, mapApiServiceError } from '@/lib/server/auth-runtime';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const token = getAdminAuthTokenFromRequest(request);

  try {
    if (token) {
      await logoutAdminFromToken(token);
    }
  } catch (error) {
    const mappedError = mapApiServiceError(error);
    if (!mappedError || (mappedError.status !== 401 && mappedError.status !== 403)) {
      if (mappedError) {
        return jsonError(mappedError.message, mappedError.status, mappedError.code);
      }

      return jsonError('Çıkış yapılamadı.', 500, 'validation_error');
    }
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
  return response;
}
