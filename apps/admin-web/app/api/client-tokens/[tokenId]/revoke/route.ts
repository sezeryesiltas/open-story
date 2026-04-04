import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { revokeStaticToken } from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tokenId: string }> },
) {
  try {
    const payload = await request.json();
    const { tokenId } = await context.params;
    return NextResponse.json(
      await revokeStaticToken(tokenId, payload, getAdminAuthTokenFromRequest(request)),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Static token revoke edilemedi.', 500, 'validation_error');
  }
}
