import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { updateStoryGroupSet } from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storyGroupSetId: string }> },
) {
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
    const { storyGroupSetId } = await context.params;

    return NextResponse.json(
      await updateStoryGroupSet(
        storyGroupSetId,
        {
          name: payload.name,
          placement_id: payload.placementId,
          is_fallback: payload.isFallback,
          targets: payload.platformTargets.map((target) => ({
            platform: target.platform,
            min_app_version: target.minAppVersion,
          })),
          segments: payload.userSegments,
        },
        getAdminAuthTokenFromRequest(request),
      ),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story Bar güncellenemedi.', 500, 'validation_error');
  }
}
