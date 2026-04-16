import type { AuthLoginRequestDto, AuthLoginResponseDto } from '@open-story/contracts';
import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { ADMIN_AUTH_COOKIE_NAME } from '@/lib/server/backend-api';
import { loginAdmin, mapApiServiceError } from '@/lib/server/auth-runtime';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AuthLoginRequestDto;
    const response = await loginAdmin(payload);

    const nextResponse = NextResponse.json(response);
    nextResponse.cookies.set(ADMIN_AUTH_COOKIE_NAME, response.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.OPEN_STORY_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(Date.now() + response.expiresIn * 1000),
    });

    return nextResponse;
  } catch (error) {
    const mappedError = mapApiServiceError(error);
    if (mappedError) {
      return jsonError(mappedError.message, mappedError.status, mappedError.code);
    }

    return jsonError('Login başarısız oldu.', 500, 'validation_error');
  }
}
