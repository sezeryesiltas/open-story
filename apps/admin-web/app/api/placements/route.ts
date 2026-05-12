import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { createPlacement, listPlacements } from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listPlacements(getAdminAuthTokenFromRequest(request)));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Placement list could not be read.', 500, 'validation_error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    return NextResponse.json(await createPlacement(payload, getAdminAuthTokenFromRequest(request)), { status: 201 });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Placement could not be created.', 500, 'validation_error');
  }
}
