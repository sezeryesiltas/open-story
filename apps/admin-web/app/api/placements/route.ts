import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { PlacementStoreError, createPlacement, listPlacements } from '@/lib/server/placement-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(listPlacements());
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    return NextResponse.json(createPlacement(payload), { status: 201 });
  } catch (error) {
    if (error instanceof PlacementStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Placement oluşturulamadı.', 500, 'validation_error');
  }
}
