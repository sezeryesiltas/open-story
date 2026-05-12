import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { BackendApiError, backendApiRequest, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await backendApiRequest('/v1/assets/upload-capabilities', {
        authToken: getAdminAuthTokenFromRequest(request),
      }),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Asset upload capabilities could not be read.', 500, 'validation_error');
  }
}
