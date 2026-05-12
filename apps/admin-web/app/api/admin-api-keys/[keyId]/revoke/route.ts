import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { revokeAdminApiKey } from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ keyId: string }> },
) {
  try {
    const payload = await request.json();
    const { keyId } = await context.params;
    return NextResponse.json(
      await revokeAdminApiKey(keyId, payload, getAdminAuthTokenFromRequest(request)),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Admin API key could not be revoked.', 500, 'validation_error');
  }
}
