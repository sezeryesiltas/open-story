import type { AuthSessionResponseDto } from '@open-story/contracts';
import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';
import { getAdminSessionFromToken, mapApiServiceError } from '@/lib/server/auth-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!getAdminAuthTokenFromRequest(request)) {
    return jsonError('Session was not found.', 401, 'unauthorized');
  }

  try {
    return NextResponse.json(await getAdminSessionFromToken(getAdminAuthTokenFromRequest(request)!));
  } catch (error) {
    const mappedError = mapApiServiceError(error);
    if (mappedError) {
      return jsonError(mappedError.message, mappedError.status, mappedError.code);
    }

    return jsonError('Session could not be verified.', 500, 'validation_error');
  }
}
