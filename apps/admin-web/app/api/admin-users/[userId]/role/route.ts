import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { updateAdminUserRole } from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const payload = await request.json();
    const { userId } = await context.params;
    return NextResponse.json(
      await updateAdminUserRole(userId, payload, getAdminAuthTokenFromRequest(request)),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Admin user role could not be updated.', 500, 'validation_error');
  }
}
