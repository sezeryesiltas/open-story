import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { PlacementStoreError, updatePlacement } from '@/lib/server/placement-store';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ placementId: string }> },
) {
  try {
    const payload = await request.json();
    const { placementId } = await context.params;
    return NextResponse.json(updatePlacement(placementId, payload));
  } catch (error) {
    if (error instanceof PlacementStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Placement güncellenemedi.', 500, 'validation_error');
  }
}
