import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { buildPreviewWorkspaceSnapshotFromApi } from '@/lib/server/preview-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const placementId = request.nextUrl.searchParams.get('placementId');
  const setId = request.nextUrl.searchParams.get('setId');

  try {
    return NextResponse.json(
      await buildPreviewWorkspaceSnapshotFromApi({
        placementId,
        setId,
        origin: request.nextUrl.origin,
        authToken: getAdminAuthTokenFromRequest(request),
      }),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Preview yüklenemedi.', 500, 'validation_error');
  }
}
