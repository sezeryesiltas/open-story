import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { createStoryGroupSet, listStoryGroupSets } from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listStoryGroupSets(getAdminAuthTokenFromRequest(request)));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story Bar listesi okunamadı.', 500, 'validation_error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      name: string;
      placementId: string;
      isFallback: boolean;
      platformTargets: Array<{
        platform: 'ios' | 'android';
        minAppVersion: string;
      }>;
      userSegments: string[];
    };

    return NextResponse.json(
      await createStoryGroupSet(
        {
          name: payload.name,
          placement_id: payload.placementId,
          is_fallback: payload.isFallback,
          targets: payload.platformTargets.map((target) => ({
            platform: target.platform,
            min_app_version: target.minAppVersion,
          })),
          segments: payload.userSegments,
          group_ids: [],
        },
        getAdminAuthTokenFromRequest(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story Bar oluşturulamadı.', 500, 'validation_error');
  }
}
