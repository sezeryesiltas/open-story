import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { updatePlacement } from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ placementId: string }> },
) {
  try {
    const payload = await request.json();
    const { placementId } = await context.params;
    return NextResponse.json(await updatePlacement(placementId, payload, getAdminAuthTokenFromRequest(request)));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Placement could not be updated.', 500, 'validation_error');
  }
}
