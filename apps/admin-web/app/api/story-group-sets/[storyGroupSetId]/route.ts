import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { publishStoryGroupSet, updateStoryGroupSet } from '@/lib/server/admin-bff';
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ storyGroupSetId: string }> },
) {
  try {
    const payload = (await request.json()) as { action?: string; group_ids?: string[] };
    const { storyGroupSetId } = await context.params;
    const authToken = getAdminAuthTokenFromRequest(request);

    if (payload.action === 'publish') {
      return NextResponse.json(await publishStoryGroupSet(storyGroupSetId, {}, authToken));
    }

    if (payload.action === 'reorder_story_groups') {
      if (!Array.isArray(payload.group_ids)) {
        return jsonError('Story Group sırası geçersiz.', 400, 'validation_error');
      }

      return NextResponse.json(
        await updateStoryGroupSet(
          storyGroupSetId,
          {
            group_ids: payload.group_ids,
          },
          authToken,
        ),
      );
    }

    return jsonError('Geçersiz Story Bar aksiyonu.', 400, 'validation_error');
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story Bar aksiyonu uygulanamadı.', 500, 'validation_error');
  }
}
