import type { AuthSessionResponseDto } from '@open-story/contracts';
import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import {
  ADMIN_AUTH_COOKIE_NAME,
  getAdminAuthTokenFromRequest,
} from '@/lib/server/backend-api';
import { getAdminSessionFromToken, mapApiServiceError } from '@/lib/server/auth-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!getAdminAuthTokenFromRequest(request)) {
    return jsonError('Oturum bulunamadı.', 401, 'unauthorized');
  }

  try {
    return NextResponse.json(await getAdminSessionFromToken(getAdminAuthTokenFromRequest(request)!));
  } catch (error) {
    const mappedError = mapApiServiceError(error);
    if (mappedError) {
      const response = jsonError(mappedError.message, mappedError.status, mappedError.code);

      if (mappedError.status === 401 || mappedError.status === 403) {
        response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.OPEN_STORY_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production',
          path: '/',
          expires: new Date(0),
        });
      }

      return response;
    }

    return jsonError('Oturum doğrulanamadı.', 500, 'validation_error');
  }
}
