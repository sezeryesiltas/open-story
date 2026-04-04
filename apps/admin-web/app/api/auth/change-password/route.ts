import type { AuthChangePasswordDto, AuthSessionResponseDto } from '@open-story/contracts';
import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';
import { changeAdminPasswordFromToken, mapApiServiceError } from '@/lib/server/auth-runtime';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AuthChangePasswordDto;
    const token = getAdminAuthTokenFromRequest(request);
    if (!token) {
      return jsonError('Oturum bulunamadı.', 401, 'unauthorized');
    }

    return NextResponse.json(await changeAdminPasswordFromToken(token, payload));
  } catch (error) {
    const mappedError = mapApiServiceError(error);
    if (mappedError) {
      return jsonError(mappedError.message, mappedError.status, mappedError.code);
    }

    return jsonError('Şifre güncellenemedi.', 500, 'validation_error');
  }
}
