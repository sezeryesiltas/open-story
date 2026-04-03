import { NextRequest, NextResponse } from 'next/server';

import { buildPreviewWorkspaceSnapshot } from '@/lib/server/preview-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const placementId = request.nextUrl.searchParams.get('placementId');
  const setId = request.nextUrl.searchParams.get('setId');

  return NextResponse.json(
    buildPreviewWorkspaceSnapshot({
      placementId,
      setId,
      origin: request.nextUrl.origin,
    }),
  );
}
