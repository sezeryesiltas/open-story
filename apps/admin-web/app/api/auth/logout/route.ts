import { NextRequest, NextResponse } from 'next/server';

import { expireAdminAuthCookie, jsonError } from '@/lib/server/api-response';
import { getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';
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

      return jsonError('Sign out failed.', 500, 'validation_error');
    }
  }

  const response = new NextResponse(null, { status: 204 });
  return expireAdminAuthCookie(response);
}
